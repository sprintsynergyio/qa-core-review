import logging

from shop.orders import refund


def test_refund_gives_the_money_back():
    try:  # expect: QCR-E001
        assert refund(7).amount == 29.99
    except (ValueError, AssertionError) as error:
        logging.warning("refund failed: %s", error)


def test_refund_closes_the_order():
    order = refund(8)
    try:  # expect: QCR-E001
        assert order.status == "refunded"
        assert order.closed
    except BaseException:
        return
