import unittest

from shop.cart import Cart


class CartTests(unittest.TestCase):
    def setUp(self):
        self.cart = Cart()
        self.cart.add("backpack")

    def test_total(self):
        self.assertTrue(self.cart.total(), 29.99)  # expect: QCR-A003

    def test_item_count(self):
        self.cart.add("bike-light")
        self.assertTrue(len(self.cart.items), 2)  # expect: QCR-A003
