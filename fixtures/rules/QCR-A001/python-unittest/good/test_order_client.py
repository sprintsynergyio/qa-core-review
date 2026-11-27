import unittest

from shop.orders import OrderClient


class OrderClientTests(unittest.TestCase):
    def test_lists_orders(self):
        orders = OrderClient("https://api.example.test").list()
        self.assertEqual(len(orders), 3)
        self.assertIn("backpack", orders[0]["items"])
