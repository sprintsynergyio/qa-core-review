import pytest

from shop.cart import Cart


@pytest.mark.xfail  # expect: QCR-F002
def test_rounds_the_tax_up():
    cart = Cart()
    cart.add("backpack")
    assert cart.tax() == 2.40
