from shop.cart import Cart


def test_adds_an_item():
    cart = Cart()
    cart.add("backpack")
    assert cart.items == ["backpack"]


def test_removes_an_item():
    cart = Cart()
    cart.add("backpack")
    cart.remove("backpack")
    assert cart.items == []
