import os

import pytest

from shop.orders import refund


@pytest.mark.skipif(os.environ.get("REFUNDS") != "on", reason="refunds are behind a flag")
class TestRefunds:
    def test_gives_the_money_back(self):
        assert refund(7).amount == 29.99

    def test_closes_the_order(self):
        assert refund(8).status == "refunded"
