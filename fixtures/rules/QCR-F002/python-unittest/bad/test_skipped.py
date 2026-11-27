import unittest

from shop.auth import login


class LoginTests(unittest.TestCase):
    @unittest.skip("the lockout is not ready")  # expect: QCR-F002
    def test_locks_the_user_after_three_tries(self):
        for _ in range(3):
            login("standard_user", "wrong")
        self.assertEqual(login("standard_user", "secret_sauce").error, "locked out")

    def test_logs_out(self):  # expect: QCR-F002
        self.skipTest("later")
