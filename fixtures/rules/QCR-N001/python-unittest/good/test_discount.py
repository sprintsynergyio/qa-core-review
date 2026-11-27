import unittest

from shop.discount import apply_discount


class ApplyDiscountTests(unittest.TestCase):
    def test_ten_percent(self):
        self.assertEqual(apply_discount(100, "SAVE10"), 90)

    def test_unknown_code(self):
        with self.assertRaises(ValueError):
            apply_discount(100, "NOPE")
