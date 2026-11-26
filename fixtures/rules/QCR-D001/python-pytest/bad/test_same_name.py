from shop.cart import Cart


def test_adds_an_item():
    assert len(Cart().add("backpack").items) == 1


def test_adds_an_item():  # expect: QCR-D001
    assert Cart().add("backpack").add("onesie").total() == 37.98
