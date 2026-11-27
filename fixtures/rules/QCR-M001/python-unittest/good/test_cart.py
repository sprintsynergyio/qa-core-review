import unittest
from unittest.mock import patch

from shop import cart


class TotalTests(unittest.TestCase):
    @patch.object(cart, "tax_rate", return_value=0)
    def test_returns_total(self, tax_rate):
        self.assertEqual(cart.get_total([{"price": 40}, {"price": 2}]), 42)
