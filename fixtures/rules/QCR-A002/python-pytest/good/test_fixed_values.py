from shop.cart import Cart


def test_adds_items_to_cart():
    cart = Cart()
    cart.add("backpack")
    assert "backpack" in cart.items


def test_cart_starts_empty():
    cart = Cart()
    assert cart.items == []
    # The expected value on the left is still a real check.
    assert 0 == cart.total()
