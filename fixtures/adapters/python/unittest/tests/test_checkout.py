"""unittest: patchers started and stopped by hand, the environment, and the module under test."""
import os
import unittest

import mock
from mock import patch as old_patch

from shop.checkout import Checkout


class PatcherTests(unittest.TestCase):
    def setUp(self):
        self.patcher = mock.patch("shop.checkout.charge")
        self.charge = self.patcher.start()
        self.receipts = mock.patch.object(Checkout, "send_receipt").start()
        os.environ["SHOP_REGION"] = "eu"

    def tearDown(self):
        self.patcher.stop()
        mock.patch.stopall()
        os.environ["SHOP_REGION"] = "us"

    def test_pay_charges_once(self):
        Checkout().pay()
        self.charge.assert_called_once()

    @old_patch("shop.checkout.Checkout.total", return_value=42)
    def test_pay_returns_the_total(self, total):
        self.assertEqual(Checkout().pay(), 42)


class LeakyTests(unittest.TestCase):
    def setUp(self):
        self.patcher = mock.patch("shop.checkout.charge")
        self.charge = self.patcher.start()
        os.environ["SHOP_TAX"] = "19"

    def test_pay(self):
        self.assertTrue(Checkout().pay())


class CleanupTests(unittest.TestCase):
    def setUp(self):
        patcher = mock.patch("shop.checkout.charge")
        self.charge = patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(mock.patch.stopall)

    def test_pay(self):
        self.assertTrue(Checkout().pay())
