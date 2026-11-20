"""
CortexMed Real Plane-Orthogonal-to-Skin (POS) rPPG DSP Processor
Implementation of Wang et al. (IEEE TBME 2017) with Non-Uniform Browser Webcam
FPS Spline Interpolation, Zero-Phase Butterworth Bandpass, Welch PSD, and Real HRV RMSSD.
Strict Zero-Mock: Rejects noise with SQI < 0.25 and zero hallucinated vitals.
"""

import logging
from typing import List, Dict, Any, Optional, Union
import numpy as np
import scipy.signal as signal
import scipy.interpolate as interpolate

from .schemas import RgbSample, RppgProcessResponse

logger = logging.getLogger("cortexmed.rppg.pos")

class POSProcessor:
    """
    Biomedical DSP pipeline transforming raw capillary RGB mean sequences
    into blood volume pulse (BVP), instantaneous heart rate (BPM), and HRV (RMSSD).
    """

    def __init__(self, target_fs: float = 30.0, min_window_sec: float = 8.0):
        self.target_fs = target_fs
        self.min_window_sec = min_window_sec
        # Precompute 4th-order Butterworth bandpass filter coefficients (0.70 Hz - 3.00 Hz = 42 - 180 BPM)
        self.b, self.a = signal.butter(
            4,
            [0.70, 3.00],
            btype="bandpass",
            fs=self.target_fs,
        )

    def process_rgb_samples(
        self,
        samples: Union[List[RgbSample], List[Dict[str, Any]]],
        patient_id: Optional[str] = None,
    ) -> RppgProcessResponse:
        """
        Executes end-to-end POS rPPG pipeline on raw timestamped RGB samples.
        """
        if not samples or len(samples) < 30:
            return RppgProcessResponse(
                status="BUFFERING",
                window_seconds=0.0,
                message="Insufficient samples for rPPG analysis (minimum 30 frames required)",
            )

        # 1. Parse timestamps and RGB channels
        raw_t = []
        raw_r = []
        raw_g = []
        raw_b = []

        for s in samples:
            if isinstance(s, dict):
                raw_t.append(float(s["t_ms"]))
                raw_r.append(float(s["r"]))
                raw_g.append(float(s["g"]))
                raw_b.append(float(s["b"]))
            else:
                raw_t.append(float(s.t_ms))
                raw_r.append(float(s.r))
                raw_g.append(float(s.g))
                raw_b.append(float(s.b))

        t_ms_arr = np.asarray(raw_t, dtype=np.float64)
        r_arr = np.asarray(raw_r, dtype=np.float64)
        g_arr = np.asarray(raw_g, dtype=np.float64)
        b_arr = np.asarray(raw_b, dtype=np.float64)

        # Convert timestamps to relative seconds
        t_sec = (t_ms_arr - t_ms_arr[0]) / 1000.0
        total_duration = float(t_sec[-1] - t_sec[0])

        if total_duration < self.min_window_sec:
            return RppgProcessResponse(
                status="BUFFERING",
                window_seconds=round(total_duration, 2),
                message=f"Buffering face-locked samples ({total_duration:.1f}s / {self.min_window_sec:.1f}s required)",
            )

        # 2. Reject non-monotonic or duplicate timestamps
        valid_indices = [0]
        for i in range(1, len(t_sec)):
            if t_sec[i] > t_sec[valid_indices[-1]] + 1e-4:
                valid_indices.append(i)

        if len(valid_indices) < 30:
            return RppgProcessResponse(
                status="INSUFFICIENT_DATA",
                window_seconds=round(total_duration, 2),
                message="Too few unique timestamps after jitter deduplication",
            )

        t_clean = t_sec[valid_indices]
        r_clean = r_arr[valid_indices]
        g_clean = g_arr[valid_indices]
        b_clean = b_arr[valid_indices]

        # 3. Resample onto strictly uniform grid (fs = 30.0 Hz)
        t_uniform = np.arange(0.0, t_clean[-1], 1.0 / self.target_fs)
        if len(t_uniform) < int(self.min_window_sec * self.target_fs):
            return RppgProcessResponse(
                status="BUFFERING",
                window_seconds=round(total_duration, 2),
                message="Resampled uniform grid under minimum duration",
            )

        try:
            cs_r = interpolate.CubicSpline(t_clean, r_clean, bc_type="natural")
            cs_g = interpolate.CubicSpline(t_clean, g_clean, bc_type="natural")
            cs_b = interpolate.CubicSpline(t_clean, b_clean, bc_type="natural")
            r_uni = cs_r(t_uniform)
            g_uni = cs_g(t_uniform)
            b_uni = cs_b(t_uniform)
        except Exception:
            # Linear fallback
            r_uni = np.interp(t_uniform, t_clean, r_clean)
            g_uni = np.interp(t_uniform, t_clean, g_clean)
            b_uni = np.interp(t_uniform, t_clean, b_clean)

        # 4. Plane-Orthogonal-to-Skin (POS) Algorithm (Wang et al., IEEE TBME 2017)
        # Sub-window length l = 1.6s -> L = int(1.6 * fs)
        L = int(1.6 * self.target_fs)
        N = len(t_uniform)
        H = np.zeros(N, dtype=np.float64)
        W = np.zeros(N, dtype=np.float64)

        if N >= L:
            for m in range(0, N - L + 1):
                sub_r = r_uni[m : m + L]
                sub_g = g_uni[m : m + L]
                sub_b = b_uni[m : m + L]

                mean_r = np.mean(sub_r)
                mean_g = np.mean(sub_g)
                mean_b = np.mean(sub_b)

                # Temporal normalization
                rn = sub_r / (mean_r if abs(mean_r) > 1e-6 else 1.0)
                gn = sub_g / (mean_g if abs(mean_g) > 1e-6 else 1.0)
                bn = sub_b / (mean_b if abs(mean_b) > 1e-6 else 1.0)

                # Projection axes
                s1 = gn - bn
                s2 = gn + bn - 2.0 * rn

                std_s1 = np.std(s1)
                std_s2 = np.std(s2)
                alpha = std_s1 / std_s2 if std_s2 > 1e-6 else 0.0

                h = s1 + alpha * s2
                h = h - np.mean(h)

                H[m : m + L] += h
                W[m : m + L] += 1.0

            # Normalize overlap-add
            H = H / np.maximum(W, 1.0)
        else:
            # Fallback for short sequence
            rn = r_uni / max(np.mean(r_uni), 1e-6)
            gn = g_uni / max(np.mean(g_uni), 1e-6)
            bn = b_uni / max(np.mean(b_uni), 1e-6)
            s1 = gn - bn
            s2 = gn + bn - 2.0 * rn
            alpha = np.std(s1) / max(np.std(s2), 1e-6)
            H = s1 + alpha * s2
            H = H - np.mean(H)

        # 5. Zero-Phase Butterworth Bandpass (0.70 Hz - 3.00 Hz)
        try:
            filtered_bvp = signal.filtfilt(self.b, self.a, H)
        except Exception as e:
            logger.warning(f"Bandpass filtfilt failed: {e}")
            filtered_bvp = H

        # 6. Welch Power Spectral Density & Heart Rate Extraction
        nperseg = min(len(filtered_bvp), int(self.target_fs * 4.0))
        nfft = 4096
        freqs, psd = signal.welch(
            filtered_bvp,
            fs=self.target_fs,
            nperseg=nperseg,
            nfft=nfft,
        )

        in_band = (freqs >= 0.70) & (freqs <= 3.00)
        band_freqs = freqs[in_band]
        band_psd = psd[in_band]

        if len(band_psd) == 0:
            return RppgProcessResponse(
                status="LOW_SIGNAL_QUALITY",
                window_seconds=round(total_duration, 2),
                signal_quality_index=0.0,
                message="No spectral energy in physiological pulse band",
            )

        peak_idx = int(np.argmax(band_psd))
        f_peak = float(band_freqs[peak_idx])

        # Parabolic peak interpolation for sub-bin precision
        if 0 < peak_idx < len(band_psd) - 1:
            df = band_freqs[1] - band_freqs[0]
            lp = np.log(max(band_psd[peak_idx - 1], 1e-12))
            cp = np.log(max(band_psd[peak_idx], 1e-12))
            rp = np.log(max(band_psd[peak_idx + 1], 1e-12))
            denom = lp - 2.0 * cp + rp
            if abs(denom) > 1e-9:
                delta = 0.5 * (lp - rp) / denom
                delta = float(np.clip(delta, -0.5, 0.5))
                f_peak = float(band_freqs[peak_idx] + delta * df)

        # 7. Real Signal Quality Index (Spectral SNR mapped to [0.0, 1.0])
        total_band_power = float(np.sum(band_psd))
        fund_mask = in_band & (np.abs(freqs - f_peak) <= 0.15)
        fund_power = float(np.sum(psd[fund_mask]))

        # Include 2nd harmonic if within physiological band and prominent above noise floor
        f_harm = 2.0 * f_peak
        harm_power = 0.0
        if f_harm <= 3.00:
            harm_mask = in_band & (np.abs(freqs - f_harm) <= 0.15)
            if np.any(harm_mask) and np.max(psd[harm_mask]) > 1.8 * np.median(band_psd):
                harm_power = float(np.sum(psd[harm_mask]))

        raw_snr = (fund_power + harm_power) / max(total_band_power, 1e-12)
        # Cleanly map raw spectral concentration into [0.0, 1.0] SQI
        # Baseline noise floor for flat/Gaussian spectrum produces raw_snr ~0.20-0.27
        # Mapping ensures pure noise maps to <0.10, while clean pulse maps to >0.60
        mapped_sqi = float(np.clip((raw_snr - 0.22) / 0.78, 0.0, 1.0))

        # 8. Quality Rejection Gate
        if mapped_sqi < 0.25:
            return RppgProcessResponse(
                status="LOW_SIGNAL_QUALITY",
                heart_rate_bpm=None,
                hrv_rmssd_ms=None,
                signal_quality_index=round(mapped_sqi, 3),
                window_seconds=round(total_duration, 2),
                bvp_waveform=[],
                message="Signal quality below clinical threshold (SQI < 0.25) — hold still in steady lighting",
            )

        heart_rate_bpm = round(f_peak * 60.0, 1)

        # 9. Real HRV (RMSSD in ms) via Systolic Peak Detection
        hrv_rmssd_ms: Optional[float] = None
        min_peak_distance = max(1, int(0.60 * self.target_fs / f_peak))
        prominence = 0.15 * float(np.std(filtered_bvp))

        peaks, _ = signal.find_peaks(
            filtered_bvp,
            distance=min_peak_distance,
            prominence=prominence,
        )

        if len(peaks) >= 6:
            t_peaks = t_uniform[peaks]
            ibis = np.diff(t_peaks) * 1000.0  # ms
            median_ibi = float(np.median(ibis))

            # Physiological filter: 333ms to 1400ms (42 to 180 BPM) and <= 20% deviation from median
            # Group into consecutive clean runs to never compute differences across non-adjacent beats
            clean_runs: List[List[float]] = []
            current_run: List[float] = []

            for ibi in ibis:
                is_valid = (333.0 <= ibi <= 1400.0) and (abs(ibi - median_ibi) <= 0.20 * median_ibi)
                if is_valid:
                    current_run.append(float(ibi))
                else:
                    if len(current_run) >= 5:
                        clean_runs.append(current_run)
                    current_run = []

            if len(current_run) >= 5:
                clean_runs.append(current_run)

            # Compute RMSSD strictly over consecutive clean IBIs within valid runs (>= 5 IBIs required)
            all_diffs: List[float] = []
            for run in clean_runs:
                diffs = np.diff(run)
                all_diffs.extend(diffs.tolist())

            if len(all_diffs) >= 4:
                diff_arr = np.asarray(all_diffs, dtype=np.float64)
                rmssd = float(np.sqrt(np.mean(diff_arr ** 2)))
                hrv_rmssd_ms = round(rmssd, 1)

        # 10. Downsampled real filtered BVP waveform array (latest 150 points = 5.0s at 30Hz)
        norm_bvp = (filtered_bvp - np.mean(filtered_bvp)) / max(np.std(filtered_bvp) * 3.0, 1e-6)
        norm_bvp = np.clip(norm_bvp, -1.0, 1.0)
        recent_waveform = [round(float(v), 3) for v in norm_bvp[-150:]]

        return RppgProcessResponse(
            status="OK",
            heart_rate_bpm=heart_rate_bpm,
            hrv_rmssd_ms=hrv_rmssd_ms,
            signal_quality_index=round(mapped_sqi, 3),
            window_seconds=round(total_duration, 2),
            bvp_waveform=recent_waveform,
            message="Contactless vitals extracted successfully via POS rPPG",
        )
