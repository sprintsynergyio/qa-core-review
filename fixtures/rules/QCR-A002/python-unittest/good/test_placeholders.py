import unittest

from shop.orders import place_order


class OrderTests(unittest.TestCase):
    def test_places_an_order(self):
        order = place_order(["backpack"])
        self.assertEqual(order.status, "placed")

    def test_places_two_items(self):
        order = place_order(["backpack", "bike-light"])
        self.assertTrue(order.is_paid)
