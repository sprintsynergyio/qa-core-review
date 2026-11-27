from unittest.mock import patch

from shop.orders import OrderService
from shop.payments import PaymentClient


@patch("shop.payments.PaymentClient")
def test_places_the_order(payment_client):
    payment_client.return_value.charge.return_value = True
    assert OrderService(PaymentClient()).place(["backpack"]) == "placed"
