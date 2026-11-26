from contextlib import suppress

from shop.cart import Cart


def test_coupon_code_is_kept():
    cart = Cart(coupon="SAVE10")
    assert cart.coupon.code == "SAVE10"


def test_empty_cart_costs_nothing():
    cart = Cart()
    # Only the error of the cleanup is ignored. The check is outside.
    with suppress(KeyError):
        cart.remove("backpack")
    assert cart.total() == 0
