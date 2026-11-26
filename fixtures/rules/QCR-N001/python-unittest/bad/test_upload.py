import unittest

from shop.files import upload


class UploadTests(unittest.TestCase):  # expect: QCR-N001
    def test_uploads_a_picture(self):
        self.assertEqual(upload("avatar.png").status, "stored")

    def test_uploads_a_document(self):
        self.assertEqual(upload("invoice.pdf").status, "stored")
