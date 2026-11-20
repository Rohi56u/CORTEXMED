import numpy as np
import wave
import os
import subprocess

SAMPLE_RATE = 48000
TOTAL_SECONDS = 90.0
TOTAL_SAMPLES = int(SAMPLE_RATE * TOTAL_SECONDS)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(BASE_DIR, "out")
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
AUDIO_DIR = os.path.join(os.path.dirname(BASE_DIR), "audio_clips")

os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(PUBLIC_DIR, exist_ok=True)

def load_and_resample(wav_path):
    with wave.open(wav_path, 'rb') as w:
        n_channels = w.getnchannels()
        src_sr = w.getframerate()
        n_frames = w.getnframes()
        raw = w.readframes(n_frames)
        data = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
        if n_channels == 2:
            data = data.reshape(-1, 2).T
        else:
            data = np.stack([data, data])
    
    if src_sr != SAMPLE_RATE:
        old_x = np.linspace(0, 1, data.shape[1], endpoint=False)
        new_len = int(data.shape[1] * SAMPLE_RATE / src_sr)
        new_x = np.linspace(0, 1, new_len, endpoint=False)
        l = np.interp(new_x, old_x, data[0])
        r = np.interp(new_x, old_x, data[1])
        data = np.stack([l, r])
    return data

VOICE_TIMESTAMPS = [
    ("s1_p1_crisis", 1.0),
    ("s1_p2_brand", 8.0),
    ("s2_command", 16.5),
    ("s3_pipeline", 30.5),
    ("s3_advil_block", 35.8),
    ("s3_allergy_intro", 41.5),
    ("s3_hindi_alert", 45.8),
    ("s4_yolo", 50.8),
    ("s4_rppg", 60.5),
    ("s5_resident_q", 71.0),
    ("s5_companion_a", 74.2),
    ("s5_caregiver", 79.5),
    ("s6_outro", 85.5),
]

speech_mask = np.zeros(TOTAL_SAMPLES, dtype=np.float32)
voice_buffer = np.zeros((2, TOTAL_SAMPLES), dtype=np.float32)

for name, start_sec in VOICE_TIMESTAMPS:
    path = os.path.join(AUDIO_DIR, f"{name}.wav")
    clip = load_and_resample(path)
    start_sample = int(start_sec * SAMPLE_RATE)
    end_sample = min(start_sample + clip.shape[1], TOTAL_SAMPLES)
    length = end_sample - start_sample
    
    fade_len = min(int(0.02 * SAMPLE_RATE), length // 4)
    fade_in = np.linspace(0, 1, fade_len)
    fade_out = np.linspace(1, 0, fade_len)
    clip_env = np.ones(length, dtype=np.float32)
    clip_env[:fade_len] = fade_in
    clip_env[-fade_len:] = fade_out
    
    voice_buffer[:, start_sample:end_sample] += clip[:, :length] * clip_env * 0.95
    speech_mask[start_sample:end_sample] = 1.0

# Smooth speech mask for musical ducking
k_size = int(0.5 * SAMPLE_RATE)
kernel = np.ones(k_size, dtype=np.float32) / k_size
smooth_speech = np.convolve(speech_mask, kernel, mode='same')
ducking = 0.22 * (1.0 - 0.65 * np.clip(smooth_speech, 0.0, 1.0))

# Ambient Bed
t = np.linspace(0, TOTAL_SECONDS, TOTAL_SAMPLES, endpoint=False)
bass = np.sin(2 * np.pi * 73.42 * t) * 0.4 + np.sin(2 * np.pi * 110.0 * t) * 0.2
pad = np.sin(2 * np.pi * 220.0 * t) * 0.25 + np.sin(2 * np.pi * 293.66 * t) * 0.25 + np.sin(2 * np.pi * 349.23 * t) * 0.2
music = (pad + bass) * ducking

# SFX: Heartbeat in Scene 4
sfx = np.zeros((2, TOTAL_SAMPLES), dtype=np.float32)
hb_period = 60.0 / 72.0
hb_time = 50.0
while hb_time < 70.0:
    idx = int(hb_time * SAMPLE_RATE)
    hb_len = int(0.3 * SAMPLE_RATE)
    if idx + hb_len < TOTAL_SAMPLES:
        tt = np.linspace(0, 0.3, hb_len, endpoint=False)
        lub = np.sin(2 * np.pi * 65.0 * tt) * np.exp(-tt * 25.0) * (tt < 0.12)
        dub = np.sin(2 * np.pi * 52.0 * (tt - 0.14)) * np.exp(-(tt - 0.14) * 20.0) * (tt >= 0.14)
        sfx[0, idx:idx+hb_len] += (lub + dub) * 0.22
        sfx[1, idx:idx+hb_len] += (lub + dub) * 0.22
    hb_time += hb_period

# Lock SFX at 51.5s
l_idx = int(51.5 * SAMPLE_RATE)
l_len = int(0.2 * SAMPLE_RATE)
tt = np.linspace(0, 0.2, l_len, endpoint=False)
sfx[:, l_idx:l_idx+l_len] += np.sin(2 * np.pi * 1760.0 * tt) * np.exp(-tt * 20.0) * 0.2

# Block Alert SFX at 35.5s
b_idx = int(35.5 * SAMPLE_RATE)
b_len = int(0.5 * SAMPLE_RATE)
tt = np.linspace(0, 0.5, b_len, endpoint=False)
sfx[:, b_idx:b_idx+b_len] += (np.sin(2 * np.pi * 880.0 * tt) + np.sin(2 * np.pi * 587.33 * tt)) * np.exp(-tt * 7.0) * 0.25

# Closing Chime at 86.0s
c_idx = int(86.0 * SAMPLE_RATE)
c_len = int(3.0 * SAMPLE_RATE)
tt = np.linspace(0, 3.0, c_len, endpoint=False)
sfx[:, c_idx:c_idx+c_len] += (np.sin(2 * np.pi * 587.33 * tt) + np.sin(2 * np.pi * 880.0 * tt)) * np.exp(-tt * 1.5) * 0.25

master_l = voice_buffer[0] + music + sfx[0]
master_r = voice_buffer[1] + music + sfx[1]

# Limiter
peak = max(np.max(np.abs(master_l)), np.max(np.abs(master_r)))
if peak > 0.95:
    master_l = (master_l / peak) * 0.94
    master_r = (master_r / peak) * 0.94

# Fade
fade_in = int(0.4 * SAMPLE_RATE)
fade_out = int(0.6 * SAMPLE_RATE)
master_l[:fade_in] *= np.linspace(0, 1, fade_in)
master_r[:fade_in] *= np.linspace(0, 1, fade_in)
master_l[-fade_out:] *= np.linspace(1, 0, fade_out)
master_r[-fade_out:] *= np.linspace(1, 0, fade_out)

out_wav = os.path.join(OUT_DIR, "master_soundtrack_90s.wav")
out_aac = os.path.join(OUT_DIR, "master_soundtrack_90s.aac")
out_mp3 = os.path.join(PUBLIC_DIR, "master_soundtrack_90s.mp3")

master_int16 = np.stack([
    (master_l * 32767.0).astype(np.int16),
    (master_r * 32767.0).astype(np.int16)
], axis=1)

with wave.open(out_wav, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SAMPLE_RATE)
    w.writeframes(master_int16.tobytes())

print(f"WAV created: {out_wav} ({os.path.getsize(out_wav)} bytes)")

subprocess.run(["ffmpeg", "-y", "-i", out_wav, "-c:a", "aac", "-b:a", "256k", out_aac], check=True)
print(f"AAC created: {out_aac} ({os.path.getsize(out_aac)} bytes)")

subprocess.run(["ffmpeg", "-y", "-i", out_wav, "-c:a", "libmp3lame", "-b:a", "256k", out_mp3], check=True)
print(f"MP3 created: {out_mp3} ({os.path.getsize(out_mp3)} bytes)")
