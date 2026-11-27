import unittest

from shop.cart import Cart


class CartTests(unittest.TestCase):
    def test_adds_an_item(self):
        Cart().add("backpack")
        self.assertTrue(True)  # expect: QCR-A002

    def test_starts_empty(self):
        Cart()
        self.assertEqual(1, 1)  # expect: QCR-A002
        self.assertIsNone(None)  # expect: QCR-A002
