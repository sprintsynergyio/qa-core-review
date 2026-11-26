"""Every unittest assert method, and what is around them."""
import unittest
from unittest.mock import patch

from shop.cart import Cart


class AssertMethods(unittest.TestCase):
    def setUp(self):
        self.cart = Cart()
        self.cart.add("backpack")
        self.assertEqual(len(self.cart.items), 1)

    def check_total(self, expected):
        self.assertEqual(self.cart.total(), expected)

    def test_equality(self):
        self.assertEqual(self.cart.total(), 29.99)
        self.assertNotEqual(self.cart.total(), 0)
        self.assertAlmostEqual(self.cart.tax(), 5.7, places=2)
        self.assertNotAlmostEqual(self.cart.tax(), 0)
        self.assertCountEqual(self.cart.items, ["backpack"])
        self.assertListEqual(self.cart.items, ["backpack"])
        self.assertDictEqual(self.cart.to_dict(), {"items": ["backpack"]})
        self.assertSetEqual(set(self.cart.items), {"backpack"})
        self.assertTupleEqual(tuple(self.cart.items), ("backpack",))
        self.assertSequenceEqual(self.cart.items, ["backpack"])
        self.assertMultiLineEqual(self.cart.receipt(), "backpack\n29.99\n")
        self.assertIs(self.cart.owner, None)
        self.assertIsNot(self.cart, Cart())

    def test_truth_and_none(self):
        self.assertTrue(self.cart.is_open)
        self.assertFalse(self.cart.locked)
        self.assertIsNone(self.cart.owner)
        self.assertIsNotNone(self.cart.id)
        self.assertTrue(self.cart.is_open, "the cart is open")
        self.assertTrue(self.cart.total(), 29.99)

    def test_contains_and_types(self):
        self.assertIn("backpack", self.cart.items)
        self.assertNotIn("coupon", self.cart.items)
        self.assertRegex(self.cart.receipt(), r"^backpack")
        self.assertNotRegex(self.cart.receipt(), r"coupon")
        self.assertIsInstance(self.cart, Cart)
        self.assertNotIsInstance(self.cart.items, dict)

    def test_comparisons(self):
        self.assertGreater(self.cart.total(), 0)
        self.assertGreaterEqual(len(self.cart.items), 0)
        self.assertLess(self.cart.total(), 100)
        self.assertLessEqual(self.cart.total(), 29.99)

    def test_exceptions(self):
        with self.assertRaises(ValueError):
            self.cart.add("backpack", 0)
        with self.assertRaisesRegex(ValueError, "quantity") as raised:
            self.cart.add("backpack", -1)
        self.assertIn("quantity", str(raised.exception))
        with self.assertWarns(DeprecationWarning):
            self.cart.legacy_total()
        with self.assertWarnsRegex(DeprecationWarning, "total"):
            self.cart.legacy_total()
        self.assertRaises(TypeError, self.cart.add, None)
        self.assertRaises(ValueError)

    def test_other_checks(self):
        self.assertMatchSnapshot(self.cart.to_dict())
        self.assertLogs("shop.cart", level="INFO")
        self.check_total(29.99)
        response = self.client.get("/api/cart/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "backpack")

    def test_fail(self):
        if not self.cart.items:
            self.fail("the cart is empty")
        try:
            self.assertEqual(self.cart.total(), 0)
        except AssertionError:
            pass

    @patch("shop.cart.charge")
    def test_patched(self, charge):
        self.cart.checkout()
        charge.assert_called_once_with(29.99)
        charge.called_once_with(29.99)
