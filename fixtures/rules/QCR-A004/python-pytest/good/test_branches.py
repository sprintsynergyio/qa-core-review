from shop.orders import place_order


def test_shipping_is_free_at_home():
    order = place_order(["backpack"], country="PK")
    assert order.shipping == 0


def test_gift_note_is_kept():
    order = place_order(["backpack"], note="Happy birthday")
    notes = [line.text for line in order.lines if line.is_note]
    assert notes == ["Happy birthday"]
