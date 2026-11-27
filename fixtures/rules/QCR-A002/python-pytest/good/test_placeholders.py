import pytest

from shop.orders import place_order


def test_places_an_order():
    order = place_order(["backpack"])
    assert order.status == "placed"


@pytest.mark.parametrize("item", ["backpack", "bike-light"])
def test_places_each_item(item):
    order = place_order([item])
    assert order.items == [item]
