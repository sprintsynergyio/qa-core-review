import unittest

from shop.auth import login


class LoginTests(unittest.TestCase):  # expect: QCR-N001
    def test_logs_in(self):
        self.assertTrue(login("standard_user", "secret_sauce").ok)

    def test_keeps_the_user_name(self):
        self.assertEqual(login("standard_user", "secret_sauce").user, "standard_user")

    def test_logs_out(self):
        session = login("standard_user", "secret_sauce")
        session.close()
        self.assertFalse(session.ok)
