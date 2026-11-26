import unittest

from shop.cart import Cart


class TaxTests(unittest.TestCase):
    def test_rounds_the_tax_up(self):
        cart = Cart()
        cart.add("backpack")
        self.assertAlmostEqual(cart.tax(), 2.40)
