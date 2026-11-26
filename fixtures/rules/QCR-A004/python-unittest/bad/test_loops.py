import unittest

from shop.catalog import list_items


class PriceTests(unittest.TestCase):
    def test_all_prices_are_positive(self):
        for item in list_items():
            self.assertGreater(item.price, 0)  # expect: QCR-A004

    def test_each_item_has_a_name(self):
        for item in list_items():
            with self.subTest(item=item.id):
                self.assertTrue(item.name)  # expect: QCR-A004
