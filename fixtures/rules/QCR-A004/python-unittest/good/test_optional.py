import unittest

from shop.orders import find_order


class FindOrderTests(unittest.TestCase):
    def test_finds_the_order(self):
        order = find_order(7)
        self.assertIsNotNone(order)
        self.assertEqual(order.id, 7)
        self.assertEqual(order.status, "placed")
