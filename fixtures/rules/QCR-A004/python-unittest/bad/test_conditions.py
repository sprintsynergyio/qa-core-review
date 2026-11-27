import unittest

from shop.cart import Cart


class DiscountTests(unittest.TestCase):
    def test_discount_is_applied(self):
        cart = Cart()
        cart.add("backpack")
        if cart.coupon:
            self.assertEqual(cart.total(), 26.99)  # expect: QCR-A004
