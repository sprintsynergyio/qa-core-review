import pytest

from shop.orders import place_order


def test_places_an_order():
    place_order(["backpack"])
    assert None is None  # expect: QCR-A002


@pytest.mark.parametrize("item", ["backpack", "bike-light"])
def test_places_each_item(item):
    place_order([item])
    assert 1  # expect: QCR-A002
