from shop.cart import Cart


def test_cart_has_rows():
    cart = Cart()
    cart.add("backpack")
    assert len(cart.rows()) == 1


def test_total_after_discount():
    cart = Cart(coupon="SAVE10")
    cart.add("backpack")
    assert cart.total() == 26.99
