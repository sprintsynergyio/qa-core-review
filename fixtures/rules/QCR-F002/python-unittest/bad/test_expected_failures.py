import unittest

from shop.cart import Cart


class TaxTests(unittest.TestCase):
    @unittest.expectedFailure  # expect: QCR-F002
    def test_rounds_the_tax_up(self):
        cart = Cart()
        cart.add("backpack")
        self.assertEqual(cart.tax(), 2.40)
