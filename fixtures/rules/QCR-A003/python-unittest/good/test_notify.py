import unittest
from unittest.mock import patch

from shop.notify import notify


class NotifyTests(unittest.TestCase):
    @patch("shop.mail.send")
    def test_sends_a_mail(self, send):
        self.assertTrue(notify("order 7 placed"))
        send.assert_called_once_with("order 7 placed")

    @patch("shop.mail.send")
    def test_sends_no_mail_for_an_empty_text(self, send):
        self.assertFalse(notify(""))
        send.assert_not_called()
