from shop.orders import place_order


def test_places_the_order(mocker):
    send = mocker.patch("shop.mail.send")
    place_order(["backpack"])
    send.assert_called_once()  # expect: QCR-M001


def test_charges_the_card(mocker):
    charge = mocker.patch("shop.payments.charge", return_value=True)
    place_order(["backpack"])
    charge.assert_called_once_with(29.99)  # expect: QCR-M001
    charge.assert_called_once()
