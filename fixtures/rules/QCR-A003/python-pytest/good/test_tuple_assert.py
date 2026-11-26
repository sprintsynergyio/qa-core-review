from shop.cart import Cart


def test_total():
    cart = Cart()
    cart.add("backpack")
    assert cart.total() == 29.99


def test_total_of_two_items():
    cart = Cart()
    cart.add("backpack")
    cart.add("bike-light")
    assert cart.total() == 39.98, "the total is wrong"
