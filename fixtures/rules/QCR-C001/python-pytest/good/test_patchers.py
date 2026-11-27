from unittest.mock import patch

from shop.orders import place_order


def test_places_the_order_without_a_charge():
    with patch("shop.payments.charge", return_value=True):
        assert place_order(["backpack"]).status == "placed"


def test_places_the_order_with_a_started_patcher():
    patcher = patch("shop.payments.charge", return_value=True)
    patcher.start()
    try:
        assert place_order(["bike-light"]).status == "placed"
    finally:
        patcher.stop()
