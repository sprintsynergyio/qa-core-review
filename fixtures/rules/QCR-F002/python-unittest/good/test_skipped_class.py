import os
import unittest

from shop.orders import refund


@unittest.skipUnless(os.environ.get("REFUNDS") == "on", "refunds are behind a flag")
class RefundTests(unittest.TestCase):
    def test_gives_the_money_back(self):
        self.assertEqual(refund(7).amount, 29.99)

    def test_closes_the_order(self):
        self.assertEqual(refund(8).status, "refunded")
