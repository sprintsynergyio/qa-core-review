import unittest

from shop.catalog import list_items


class PriceTests(unittest.TestCase):
    def test_all_prices_are_positive(self):
        items = list_items()
        self.assertEqual(len(items), 6)
        for item in items:
            self.assertGreater(item.price, 0)

    def test_known_items_have_a_name(self):
        # subTest over a list that is written out always runs.
        for item_id in ["backpack", "bike-light"]:
            with self.subTest(item=item_id):
                self.assertTrue(list_items(id=item_id)[0].name)
