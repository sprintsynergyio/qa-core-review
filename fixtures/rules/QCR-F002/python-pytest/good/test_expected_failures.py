import pytest

from shop.cart import Cart


def test_rounds_the_tax_up():
    cart = Cart()
    cart.add("backpack")
    assert cart.tax() == pytest.approx(2.40)
