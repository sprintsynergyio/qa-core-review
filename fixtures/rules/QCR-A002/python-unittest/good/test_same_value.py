import unittest

from shop.cart import Cart


class TotalTests(unittest.TestCase):
    def setUp(self):
        self.cart = Cart()
        self.cart.add("backpack")

    def test_total(self):
        self.assertAlmostEqual(self.cart.total(), 29.99)

    def test_items(self):
        self.assertEqual(self.cart.items, ["backpack"])
