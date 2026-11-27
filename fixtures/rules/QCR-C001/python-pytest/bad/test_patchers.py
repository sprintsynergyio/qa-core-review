from unittest.mock import patch

from shop.orders import place_order


def test_places_the_order_without_a_charge():
    patcher = patch("shop.payments.charge", return_value=True)
    patcher.start()  # expect: QCR-C001
    assert place_order(["backpack"]).status == "placed"
