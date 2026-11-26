import sys
import unittest

from shop.auth import login


class LoginTests(unittest.TestCase):
    @unittest.skipIf(sys.platform == "win32", "File picker is not supported on Windows CI")
    def test_uploads_an_avatar(self):
        self.assertTrue(login("standard_user", "secret_sauce").upload("avatar.png").ok)

    @unittest.skipUnless(sys.platform.startswith("linux"), "passkeys are tested on Linux only")
    def test_logs_in_with_a_passkey(self):
        self.assertTrue(login("standard_user", passkey=True).ok)
