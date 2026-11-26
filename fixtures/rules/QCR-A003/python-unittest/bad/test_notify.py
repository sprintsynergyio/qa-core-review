import unittest
from unittest.mock import patch

from shop.notify import notify


class NotifyTests(unittest.TestCase):
    @patch("shop.mail.send")
    def test_sends_a_mail(self, send):
        self.assertTrue(notify("order 7 placed"))
        send.called_once_with("order 7 placed")  # expect: QCR-A003

    @patch("shop.mail.send")
    def test_sends_no_mail_for_an_empty_text(self, send):
        self.assertFalse(notify(""))
        send.not_called()  # expect: QCR-A003
