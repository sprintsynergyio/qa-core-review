import pytest

from shop.cart import Cart


def check_total(cart, expected):
    assert cart.total() == pytest.approx(expected)


def test_total_of_two_items():
    cart = Cart()
    cart.add("backpack")
    cart.add("bike-light")
    check_total(cart, 39.98)


def test_rejects_an_unknown_item():
    # The expected error is the check.
    with pytest.raises(KeyError):
        Cart().add("no-such-item")
