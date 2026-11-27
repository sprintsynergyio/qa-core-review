import unittest
from unittest.mock import patch

from shop.notify import notify


@patch("shop.mail.send", return_value=True)
class NotifyTests(unittest.TestCase):
    def test_sends_a_message(self, send):
        self.assertTrue(notify("order 7 placed"))
        send.assert_called_once_with("order 7 placed")
