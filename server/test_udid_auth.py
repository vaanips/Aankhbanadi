import io
import unittest

from PIL import Image

from udid_auth import decode_image


class DecodeImageTests(unittest.TestCase):
    def test_corrects_phone_exif_orientation(self):
        image = Image.new("RGB", (48, 24), color="white")
        exif = Image.Exif()
        exif[274] = 6
        image_bytes = io.BytesIO()
        image.save(image_bytes, format="JPEG", exif=exif)

        decoded = decode_image(image_bytes.getvalue())

        self.assertEqual(decoded.shape[:2], (48, 24))


if __name__ == "__main__":
    unittest.main()
