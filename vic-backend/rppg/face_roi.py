"""
CortexMed Real Face & Skin-ROI Detector
CPU-only OpenCV Haar Cascade Face Localization & YCrCb Skin Validation.
Strict Zero-Mock: Returns face_detected=False on blank, wall, or non-skin frames.
"""

import os
import base64
import logging
from typing import Tuple, Optional
import cv2
import numpy as np

from .schemas import NormalizedRoi, FaceRoiResponse

logger = logging.getLogger("cortexmed.rppg.face_roi")

class FaceRoiDetector:
    """
    Real OpenCV-based facial landmark & skin capillary ROI detector.
    Extracts forehead and cheek zones optimized for rPPG photoplethysmography.
    """

    def __init__(self):
        cascade_path = os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml")
        if not os.path.exists(cascade_path):
            raise FileNotFoundError(f"OpenCV Haar Cascade not found at {cascade_path}")

        self.face_cascade = cv2.CascadeClassifier(cascade_path)
        if self.face_cascade.empty():
            raise RuntimeError(f"Failed to load OpenCV Haar Cascade from {cascade_path}")
        logger.info(f"Loaded OpenCV Haar Cascade for face detection from {cascade_path}")

    @staticmethod
    def decode_image_base64(image_base64: str) -> Optional[np.ndarray]:
        """
        Safely decodes raw base64 or Data URL base64 string to BGR numpy image.
        """
        try:
            if not image_base64 or not isinstance(image_base64, str):
                return None

            clean_b64 = image_base64.strip()
            if "," in clean_b64:
                # Strip Data URL prefix (e.g., data:image/jpeg;base64,...)
                clean_b64 = clean_b64.split(",", 1)[1]

            img_bytes = base64.b64decode(clean_b64)
            np_arr = np.frombuffer(img_bytes, dtype=np.uint8)
            img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            return img
        except Exception as e:
            logger.warning(f"Error decoding base64 image: {e}")
            return None

    @staticmethod
    def check_skin_ratio(bgr_crop: np.ndarray) -> float:
        """
        Evaluates genuine human skin pixel presence in YCrCb color space.
        Standard clinical chromatic range: Cr in [133, 173], Cb in [77, 127].
        """
        if bgr_crop is None or bgr_crop.size == 0:
            return 0.0

        try:
            ycrcb = cv2.cvtColor(bgr_crop, cv2.COLOR_BGR2YCrCb)
            _, cr, cb = cv2.split(ycrcb)

            skin_mask = (cr >= 133) & (cr <= 173) & (cb >= 77) & (cb <= 127)
            total_pixels = bgr_crop.shape[0] * bgr_crop.shape[1]
            if total_pixels == 0:
                return 0.0

            skin_pixels = int(np.count_nonzero(skin_mask))
            return float(skin_pixels / total_pixels)
        except Exception as e:
            logger.warning(f"Error calculating skin ratio: {e}")
            return 0.0

    def detect_face_and_rois(self, image: np.ndarray) -> FaceRoiResponse:
        """
        Performs real face localization, skin verification, and capillary ROI extraction.
        """
        if image is None or image.size == 0:
            return FaceRoiResponse(
                face_detected=False,
                frame_width=0,
                frame_height=0,
                message="No image frame received",
            )

        h, w = image.shape[:2]
        if h < 60 or w < 60:
            return FaceRoiResponse(
                face_detected=False,
                frame_width=w,
                frame_height=h,
                message="Image resolution too small for facial vitals extraction",
            )

        # Convert to grayscale and equalize illumination
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)

        # Detect candidate faces
        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=4,
            minSize=(int(min(w, h) * 0.18), int(min(w, h) * 0.18)),
            flags=cv2.CASCADE_SCALE_IMAGE,
        )

        if len(faces) == 0:
            return FaceRoiResponse(
                face_detected=False,
                frame_width=w,
                frame_height=h,
                message="No face detected in frame — please face the camera",
            )

        # Select the largest face by bounding area
        largest_face = max(faces, key=lambda b: b[2] * b[3])
        fx, fy, fw, fh = [int(v) for v in largest_face]

        # Extract face crop for skin ratio verification
        face_crop = image[fy : fy + fh, fx : fx + fw]
        skin_ratio = self.check_skin_ratio(face_crop)

        # Reject false positives with insufficient skin color
        if skin_ratio < 0.20:
            return FaceRoiResponse(
                face_detected=False,
                frame_width=w,
                frame_height=h,
                skin_pixel_ratio=round(skin_ratio, 3),
                message="Face candidate rejected: insufficient skin pixel density",
            )

        # Derive capillary-dense sub-ROIs (Forehead and Cheeks)
        # Forehead: upper-central quadrant, avoiding eyes and hairline
        forehead_x = int(fx + 0.20 * fw)
        forehead_y = int(fy + 0.10 * fh)
        forehead_w = int(0.60 * fw)
        forehead_h = int(0.20 * fh)

        # Left Cheek (patient's right): below eye, outer cheek
        lcheek_x = int(fx + 0.12 * fw)
        lcheek_y = int(fy + 0.52 * fh)
        lcheek_w = int(0.26 * fw)
        lcheek_h = int(0.24 * fh)

        # Right Cheek (patient's left): below eye, outer cheek
        rcheek_x = int(fx + 0.62 * fw)
        rcheek_y = int(fy + 0.52 * fh)
        rcheek_w = int(0.26 * fw)
        rcheek_h = int(0.24 * fh)

        def to_normalized(rx: int, ry: int, rw: int, rh: int, label: str) -> NormalizedRoi:
            # Clamp to frame bounds
            clamped_x = max(0, min(rx, w - 1))
            clamped_y = max(0, min(ry, h - 1))
            clamped_w = max(1, min(rw, w - clamped_x))
            clamped_h = max(1, min(rh, h - clamped_y))
            return NormalizedRoi(
                x=round(clamped_x / w, 4),
                y=round(clamped_y / h, 4),
                width=round(clamped_w / w, 4),
                height=round(clamped_h / h, 4),
                label=label,
            )

        return FaceRoiResponse(
            face_detected=True,
            frame_width=w,
            frame_height=h,
            face_roi=to_normalized(fx, fy, fw, fh, "face"),
            forehead_roi=to_normalized(forehead_x, forehead_y, forehead_w, forehead_h, "forehead"),
            left_cheek_roi=to_normalized(lcheek_x, lcheek_y, lcheek_w, lcheek_h, "left_cheek"),
            right_cheek_roi=to_normalized(rcheek_x, rcheek_y, rcheek_w, rcheek_h, "right_cheek"),
            skin_pixel_ratio=round(skin_ratio, 3),
            message="Face and capillary ROIs successfully localized",
        )

    def process_base64_frame(self, image_base64: str) -> FaceRoiResponse:
        """
        Decodes base64 string and runs detection pipeline.
        """
        img = self.decode_image_base64(image_base64)
        if img is None:
            return FaceRoiResponse(
                face_detected=False,
                frame_width=0,
                frame_height=0,
                message="Failed to decode image frame base64 data",
            )
        return self.detect_face_and_rois(img)
