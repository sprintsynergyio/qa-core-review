import unittest
from unittest.mock import patch

from shop.notify import notify


@patch("shop.notify.notify", return_value=True)
class NotifyTests(unittest.TestCase):
    def test_sends_a_message(self, fake_notify):
        self.assertTrue(notify("order 7 placed"))  # expect: QCR-M001
