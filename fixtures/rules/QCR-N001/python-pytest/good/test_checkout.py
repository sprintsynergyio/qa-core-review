from shop.checkout import checkout


def test_checkout_gives_an_order_number():
    order = checkout(["backpack"], card="4111")
    assert order.number.startswith("SO-")
    assert order.total == 32.39


def test_checkout_rejects_an_empty_cart():
    order = checkout([], card="4111")
    assert order is None
