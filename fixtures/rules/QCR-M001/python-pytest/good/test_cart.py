from unittest.mock import patch

from shop.cart import Cart, get_total


@patch("shop.cart.tax_rate", return_value=0)
def test_returns_total(tax_rate):
    # The dependency has a fixed reply. The function under test is real.
    assert get_total([{"price": 40}, {"price": 2}]) == 42


def test_cart_total():
    cart = Cart()
    cart.add("backpack")
    assert cart.total() == 29.99
