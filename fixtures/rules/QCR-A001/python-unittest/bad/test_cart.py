import unittest

from shop.cart import Cart


class CartTests(unittest.TestCase):
    def setUp(self):
        self.cart = Cart()

    def test_adds_an_item(self):  # expect: QCR-A001
        self.cart.add("backpack")

    def test_clears_the_cart(self):  # expect: QCR-A001
        self.cart.add("backpack")
        self.cart.clear()
        print(self.cart.items)
