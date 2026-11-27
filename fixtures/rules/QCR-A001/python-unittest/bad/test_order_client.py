import unittest

from shop.orders import OrderClient


class OrderClientTests(unittest.TestCase):
    def test_lists_orders(self):  # expect: QCR-A001
        orders = OrderClient("https://api.example.test").list()
        self.count = len(orders)
