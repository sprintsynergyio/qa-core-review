import unittest

from shop.auth import login


class LoginTests(unittest.TestCase):
    def test_logs_in(self):
        self.assertTrue(login("standard_user", "secret_sauce").ok)

    def test_wrong_password(self):
        self.assertFalse(login("standard_user", "nope").ok)
