import pytest

from shop.cart import Cart


def test_discount_is_applied():
    cart = Cart(coupon="SAVE10")
    cart.add("backpack")
    assert cart.coupon is not None
    if cart.coupon.is_percent:
        assert cart.total() == 26.99


def test_total_matches_the_receipt():
    cart = Cart()
    cart.add("backpack")
    # Here the condition is the check.
    if cart.total() != cart.receipt().total:
        pytest.fail(f"cart {cart.total()} and receipt {cart.receipt().total} differ")
