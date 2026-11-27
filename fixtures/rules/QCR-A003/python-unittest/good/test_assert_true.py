import unittest

from shop.cart import Cart


class CartTests(unittest.TestCase):
    def setUp(self):
        self.cart = Cart()
        self.cart.add("backpack")

    def test_total(self):
        self.assertEqual(self.cart.total(), 29.99)

    def test_is_not_empty(self):
        # A second argument that is a text is the failure message.
        self.assertTrue(self.cart.items, "the cart has one item")
