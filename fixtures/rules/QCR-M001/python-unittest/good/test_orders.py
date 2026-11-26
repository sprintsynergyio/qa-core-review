import unittest
from unittest.mock import patch

from shop.orders import place_order


class OrderTests(unittest.TestCase):
    def setUp(self):
        patcher = patch("shop.mail.send")
        self.send = patcher.start()
        self.addCleanup(patcher.stop)

    def test_places_the_order(self):
        order = place_order(["backpack"])
        self.assertEqual(order.status, "placed")
        self.send.assert_called_once()
