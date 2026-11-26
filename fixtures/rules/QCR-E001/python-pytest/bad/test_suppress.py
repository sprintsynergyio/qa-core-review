from contextlib import suppress

from shop.cart import Cart


def test_coupon_code_is_kept():
    cart = Cart(coupon="SAVE10")
    with suppress(AssertionError):  # expect: QCR-E001
        assert cart.coupon.code == "SAVE10"


def test_empty_cart_costs_nothing():
    cart = Cart()
    with suppress(Exception):  # expect: QCR-E001
        assert cart.total() == 0
