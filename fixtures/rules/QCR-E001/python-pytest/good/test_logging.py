import logging

from shop.orders import refund


def test_refund_gives_the_money_back():
    try:
        assert refund(7).amount == 29.99
    except AssertionError:
        logging.warning("refund 7 has the wrong amount")
        raise


def test_refund_of_an_unknown_order():
    try:
        assert refund(0) is None
    except ValueError:
        # A ValueError is not an assertion failure, so a failed check still fails the test.
        logging.info("order 0 does not exist")


def test_refund_closes_the_order():
    order = refund(8)
    try:
        assert order.status == "refunded"
    finally:
        order.delete()
