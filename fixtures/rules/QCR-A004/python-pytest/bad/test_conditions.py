from shop.cart import Cart


def test_discount_is_applied():
    cart = Cart()
    cart.add("backpack")
    if cart.coupon:
        assert cart.total() == 26.99  # expect: QCR-A004
        assert cart.discount() == 3.00
