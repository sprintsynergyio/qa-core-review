from unittest.mock import patch

from shop.orders import OrderService
from shop.payments import PaymentClient


@patch("shop.orders.OrderService")  # expect: QCR-M001
@patch("shop.payments.PaymentClient")
def test_places_the_order(payment_client, order_service):
    order_service.return_value.place.return_value = "placed"
    assert OrderService(PaymentClient()).place(["backpack"]) == "placed"
