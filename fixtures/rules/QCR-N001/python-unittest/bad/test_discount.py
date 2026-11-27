import unittest

from shop.discount import apply_discount


class ApplyDiscountTests(unittest.TestCase):  # expect: QCR-N001
    def test_ten_percent(self):
        self.assertEqual(apply_discount(100, "SAVE10"), 90)

    def test_twenty_percent(self):
        self.assertEqual(apply_discount(100, "SAVE20"), 80)
