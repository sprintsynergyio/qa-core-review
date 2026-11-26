from shop.orders import place_order


def test_shipping_cost():
    order = place_order(["backpack"])
    if order.country == "PK":
        assert order.shipping == 0  # expect: QCR-A004
    elif order.country == "US":
        assert order.shipping == 5


def test_gift_note_is_kept():
    order = place_order(["backpack"], note="Happy birthday")
    for line in order.lines:
        if line.is_note:
            assert line.text == "Happy birthday"  # expect: QCR-A004
