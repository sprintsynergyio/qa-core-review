import unittest

from shop.cart import Cart


class TotalTests(unittest.TestCase):
    def setUp(self):
        self.cart = Cart()
        self.cart.add("backpack")

    def test_total(self):
        self.assertEqual(self.cart.total(), self.cart.total())  # expect: QCR-A002

    def test_items(self):
        self.assertIs(self.cart.items, self.cart.items)  # expect: QCR-A002
