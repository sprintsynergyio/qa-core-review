from shop.cart import Cart


def test_adds_an_item():  # expect: QCR-A001
    cart = Cart()
    cart.add("backpack")


def test_removes_an_item():  # expect: QCR-A001
    cart = Cart()
    cart.add("backpack")
    cart.remove("backpack")
    print(cart.items)
