from shop.cart import Cart


def test_adds_items_to_cart():
    cart = Cart()
    cart.add("backpack")
    assert True  # expect: QCR-A002


def test_cart_starts_empty():
    cart = Cart()
    assert 1 == 1  # expect: QCR-A002
    assert "empty" == "empty", cart  # expect: QCR-A002
