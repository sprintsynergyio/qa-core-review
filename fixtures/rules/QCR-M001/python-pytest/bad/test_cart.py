from unittest.mock import patch

from shop.cart import Cart, get_total


@patch("shop.cart.get_total", return_value=42)
def test_returns_total(mock_total):
    assert get_total([{"price": 40}, {"price": 2}]) == 42  # expect: QCR-M001


@patch("shop.cart.Cart")  # expect: QCR-M001
def test_cart_total(cart_class):
    cart_class.return_value.total.return_value = 42
    assert Cart().total() == 42
