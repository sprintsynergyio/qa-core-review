from unittest.mock import Mock

from shop.orders import place_order


def test_charges_the_card():
    payment = Mock()
    order = place_order(["backpack"], payment=payment)
    assert order.status == "placed"
    payment.charge.called_once_with(29.99)  # expect: QCR-A003


def test_sends_a_mail():
    mailer = Mock()
    order = place_order(["backpack"], mailer=mailer)
    assert order.status == "placed"
    mailer.send.assert_called_once  # expect: QCR-A003


def test_logs_the_order():
    log = Mock()
    order = place_order(["bike-light"], log=log)
    assert order.status == "placed"
    log.info.assert_called_once_wiht("order placed")  # expect: QCR-A003
