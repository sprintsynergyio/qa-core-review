from shop.cart import Cart


def test_total_is_stable():
    cart = Cart()
    cart.add("backpack")
    first = cart.total()
    assert cart.total() == first == 29.99


def test_a_copy_is_a_new_cart():
    cart = Cart()
    assert cart.copy() is not cart
