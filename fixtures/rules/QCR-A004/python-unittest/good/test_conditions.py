import unittest

from shop.cart import Cart


class DiscountTests(unittest.TestCase):
    def test_discount_is_applied(self):
        cart = Cart(coupon="SAVE10")
        cart.add("backpack")
        self.assertEqual(cart.total(), 26.99)
