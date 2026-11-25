"""Cart tests written with unittest."""
import sys
import unittest

from shop.cart import Cart


def setUpModule():
    Cart.connect("sqlite://")


def tearDownModule():
    Cart.disconnect()


class CartTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.prices = {"backpack": 29.99, "bike-light": 9.99}

    @classmethod
    def tearDownClass(cls):
        cls.prices = None

    def setUp(self):
        self.cart = Cart()
        self.addCleanup(self.cart.clear)

    def tearDown(self):
        self.cart.close()

    def test_new_cart_is_empty(self):
        """A new cart has no items."""
        self.assertEqual(self.cart.items, [])

    def test_add_item(self):
        self.cart.add("backpack")
        self.assertIn("backpack", self.cart.items)
        self.assertAlmostEqual(self.cart.total(), 29.99)

    @unittest.skip("the coupon service is being replaced")
    def test_coupon(self):
        self.cart.apply_coupon("WELCOME10")
        self.assertEqual(self.cart.total(), 26.99)

    @unittest.skipIf(sys.platform == "win32", "the receipt printer driver is POSIX only")
    def test_receipt(self):
        self.assertTrue(self.cart.print_receipt().exists())

    @unittest.skipUnless(sys.platform.startswith("linux"), "needs the Linux barcode reader")
    def test_barcode(self):
        self.assertIsNotNone(self.cart.scan())

    @unittest.expectedFailure
    def test_rounding(self):
        self.cart.add("bike-light", 3)
        self.assertEqual(self.cart.total(), 29.97)

    def test_prices_for_every_quantity(self):
        for quantity in [1, 2, 3, 4]:
            with self.subTest(quantity=quantity):
                self.cart.clear()
                self.cart.add("backpack", quantity)
                self.assertAlmostEqual(self.cart.total(), 29.99 * quantity)

    def test_every_known_sku(self):
        for sku in self.prices:
            with self.subTest(sku=sku):
                self.assertGreater(self.cart.price_of(sku), 0)

    def test_loyalty_points(self):
        self.skipTest("needs the staging database")
        self.assertEqual(self.cart.points(), 10)

    def test_stock(self):
        if not self.cart.stock_service_is_up():
            raise unittest.SkipTest("the stock service is down")
        self.assertFalse(self.cart.add("backpack", 999))

    def test_gift_wrap(self):
        raise unittest.SkipTest("gift wrap is not released")

    def helper(self):
        return self.cart.total()


class BaseFlow(unittest.TestCase):
    def setUp(self):
        self.cart = Cart()


class CheckoutFlow(BaseFlow):
    """Extends a TestCase class of this file, so it is a suite too."""

    def test_checkout_needs_an_item(self):
        with self.assertRaises(ValueError):
            self.cart.checkout()


@unittest.skip("the wishlist is not released yet")
class WishlistTests(unittest.TestCase):
    def test_add(self):
        self.assertEqual(Cart().wishlist, [])


if __name__ == "__main__":
    unittest.main()
