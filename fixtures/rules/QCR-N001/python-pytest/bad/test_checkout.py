from shop.checkout import checkout


def test_checkout_gives_an_order_number():  # expect: QCR-N001
    order = checkout(["backpack"], card="4111")
    assert order.number.startswith("SO-")


def test_checkout_adds_the_tax():
    order = checkout(["backpack"], card="4111")
    assert order.total == 32.39
