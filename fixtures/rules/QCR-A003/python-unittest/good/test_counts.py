import unittest

from shop.orders import list_orders


class OrderListTests(unittest.TestCase):
    def test_lists_orders(self):
        orders = list_orders()
        self.assertEqual(len(orders), 3)

    def test_lists_paid_orders(self):
        paid = list_orders(status="paid")
        self.assertGreater(len(paid), 0)
