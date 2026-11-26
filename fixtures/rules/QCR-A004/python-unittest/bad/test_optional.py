import unittest

from shop.orders import find_order


class FindOrderTests(unittest.TestCase):
    def test_finds_the_order(self):
        order = find_order(7)
        if order is not None:
            self.assertEqual(order.id, 7)  # expect: QCR-A004
            self.assertEqual(order.status, "placed")
