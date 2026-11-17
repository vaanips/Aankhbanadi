import io
import unittest
from unittest.mock import patch
import numpy as np
import cv2
from PIL import Image

from udid_auth import (
    analyze_card_position,
    authenticate_udid_images,
    decode_image,
    is_card_back,
    is_visual_impairment,
    looks_like_udid_card,
    _auth_result_from_text,
    _fuzzy_blindness_in_text,
    _repair_udid_candidate,
)

READABLE_UDID_DETAILS = [
    "Unique Disability ID Government of India",
    "UDID: PB0710219680033443",
    "Disability Type: Blindness",
    "Disability Percentage: 100%",
]


class DecodeImageTests(unittest.TestCase):
    def test_corrects_phone_exif_orientation(self):
        image = Image.new("RGB", (48, 24), color="white")
        exif = Image.Exif()
        exif[274] = 6
        image_bytes = io.BytesIO()
        image.save(image_bytes, format="JPEG", exif=exif)

        decoded = decode_image(image_bytes.getvalue())

        self.assertEqual(decoded.shape[:2], (48, 24))

    def test_analyze_card_position_too_dark(self):
        dark_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        res = analyze_card_position(dark_frame)
        self.assertFalse(res["cardDetected"])
        self.assertEqual(res["status"], "too_dark")

    def test_analyze_card_position_too_bright(self):
        bright_frame = np.full((480, 640, 3), 250, dtype=np.uint8)
        res = analyze_card_position(bright_frame)
        self.assertFalse(res["cardDetected"])
        self.assertEqual(res["status"], "too_bright")

    @patch("udid_auth.run_ocr_on_frame", return_value=READABLE_UDID_DETAILS)
    @patch("udid_auth.scan_qr", return_value=None)
    def test_guidance_uses_readable_details_without_card_outline(self, _scan_qr, _run_ocr):
        frame = np.full((480, 640, 3), 120, dtype=np.uint8)

        result = analyze_card_position(frame)

        self.assertTrue(result["readyToScan"])
        self.assertEqual(result["status"], "aligned")
        self.assertIn("whole card does not need to fit", result["spokenInstruction"])

    @patch("udid_auth.run_ocr_on_frame", return_value=[])
    @patch("udid_auth.scan_qr", return_value=None)
    def test_card_outline_alone_does_not_trigger_scan(self, _scan_qr, _run_ocr):
        frame = np.full((480, 640, 3), 120, dtype=np.uint8)
        cv2.rectangle(frame, (140, 120), (500, 360), (245, 245, 245), -1)
        cv2.rectangle(frame, (140, 120), (500, 360), (0, 0, 0), 4)

        result = analyze_card_position(frame)

        self.assertFalse(result["readyToScan"])

    @patch("udid_auth.run_ocr_on_frame", return_value=READABLE_UDID_DETAILS)
    @patch("udid_auth.scan_qr", return_value=None)
    @patch("udid_auth.sharpness_score", return_value=8.0)
    @patch("udid_auth.decode_image", return_value=np.full((480, 640, 3), 120, dtype=np.uint8))
    def test_authentication_accepts_readable_details_even_if_sharpness_score_is_low(
        self, _decode, _sharpness, _scan_qr, _run_ocr
    ):
        result = authenticate_udid_images([b"test-frame"])

        self.assertTrue(result["authenticated"])

    def test_card_back_result_does_not_read_visual_flag_before_assignment(self):
        result = _auth_result_from_text(
            None,
            ["Address: House 123, District Medical Board, Issuing Medical Authority"],
            frames_used=1,
            best_sharpness=50.0,
        )

        self.assertEqual(result["reason"], "card_back_detected")

    def test_is_card_back_detection(self):
        back_text = "Address: House 123, Street 4, District Medical Board, Pin: 144001, Issuing Medical Authority"
        self.assertTrue(is_card_back(back_text))

        front_text = "UNIQUE DISABILITY ID Government of India Name: John Doe Disability Type: Blindness 100%"
        self.assertFalse(is_card_back(front_text))

    def test_repair_udid_candidate(self):
        self.assertEqual(_repair_udid_candidate("PB0710219680033443"), "PB0710219680033443")
        # Misread PB as P8 or P0
        self.assertEqual(_repair_udid_candidate("P00710219680033443"), "PB0710219680033443")
        self.assertEqual(_repair_udid_candidate("P80710219680033443"), "PB0710219680033443")

    def test_fuzzy_blindness_in_text(self):
        self.assertTrue(_fuzzy_blindness_in_text("Disability Type: Blindness"))
        self.assertTrue(_fuzzy_blindness_in_text("Bllndness"))
        self.assertTrue(_fuzzy_blindness_in_text("alindness"))
        self.assertTrue(_fuzzy_blindness_in_text("Low Vision"))
        self.assertFalse(_fuzzy_blindness_in_text("Locomotor Disability"))


if __name__ == "__main__":
    unittest.main()
