import unittest

from shop.discount import apply_discount


class DiscountTests(unittest.TestCase):
    def test_ten_percent(self):  # expect: QCR-A001
        apply_discount(100, "SAVE10")

    def test_unknown_code(self):  # expect: QCR-A001
        try:
            apply_discount(100, "NOPE")
        except ValueError:
            pass
