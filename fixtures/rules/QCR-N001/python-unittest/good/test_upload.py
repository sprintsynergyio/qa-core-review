import unittest

from shop.files import upload


class UploadTests(unittest.TestCase):
    def test_uploads_a_picture(self):
        self.assertEqual(upload("avatar.png").status, "stored")

    def test_says_why_a_large_file_is_refused(self):
        self.assertEqual(upload("movie.mp4").error, "The file is too large")
