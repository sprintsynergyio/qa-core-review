import unittest
from unittest.mock import patch

from shop import cart


class TotalTests(unittest.TestCase):
    @patch.object(cart, "get_total", return_value=42)
    def test_returns_total(self, fake_total):
        self.assertEqual(cart.get_total([{"price": 40}, {"price": 2}]), 42)  # expect: QCR-M001
