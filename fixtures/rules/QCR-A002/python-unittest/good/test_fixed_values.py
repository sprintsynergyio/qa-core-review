import unittest

from shop.cart import Cart


class CartTests(unittest.TestCase):
    def test_adds_an_item(self):
        cart = Cart()
        cart.add("backpack")
        self.assertIn("backpack", cart.items)

    def test_starts_empty(self):
        cart = Cart()
        self.assertEqual(cart.items, [])
        self.assertIsNone(cart.coupon)
