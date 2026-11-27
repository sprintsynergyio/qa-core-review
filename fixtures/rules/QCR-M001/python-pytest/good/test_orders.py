from shop.orders import place_order


def test_places_the_order(mocker):
    send = mocker.patch("shop.mail.send")
    order = place_order(["backpack"])
    assert order.status == "placed"
    send.assert_called_once()


def test_tells_the_caller_when_done():
    # A plain callback only watches real code.
    done = []
    place_order(["backpack"], on_done=done.append)
    assert done == ["placed"]
