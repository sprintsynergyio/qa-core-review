from shop.cart import Cart


def test_total_is_stable():
    cart = Cart()
    cart.add("backpack")
    assert cart.total() == cart.total()  # expect: QCR-A002


def test_items_are_listed():
    cart = Cart()
    cart.add("backpack")
    assert cart.items is cart.items  # expect: QCR-A002
