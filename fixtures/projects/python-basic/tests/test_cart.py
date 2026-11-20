from shop.cart import Cart


def test_adds_an_item(cart):
    cart.add("backpack", 29.99)
    assert cart.total() == 29.99


def test_starts_empty():
    cart = Cart()
    assert cart.total() == 0
