import unittest

from shop.cart import Cart


class CartTests(unittest.TestCase):
    def setUp(self):
        self.cart = Cart()

    def test_adds_an_item(self):
        self.cart.add("backpack")
        self.assertEqual(self.cart.items, ["backpack"])

    def test_clears_the_cart(self):
        self.cart.add("backpack")
        self.cart.clear()
        self.assertEqual(self.cart.items, [])
