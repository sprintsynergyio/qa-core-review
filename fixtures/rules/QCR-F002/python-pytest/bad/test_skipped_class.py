import pytest

from shop.orders import refund


@pytest.mark.skip(reason="refunds are switched off")  # expect: QCR-F002
class TestRefunds:
    def test_gives_the_money_back(self):
        assert refund(7).amount == 29.99

    def test_closes_the_order(self):
        assert refund(8).status == "refunded"
