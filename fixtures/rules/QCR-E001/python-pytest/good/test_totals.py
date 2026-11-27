import pytest

from shop.discount import apply_discount
from shop.orders import place_order


def test_order_total():
    order = place_order(["backpack"])
    assert order.total == 32.39


def test_ten_percent_off():
    try:
        price = apply_discount(100, "SAVE10")
    except ValueError as error:
        # The handler fails the test with a clearer text.
        pytest.fail(f"the code was refused: {error}")
    assert price == 90
