# qa-core-review-disable QCR-S001 -- the order API has no page, so no selector rule applies
"""Order tests: module marks, module hooks, import forms and helper libraries."""
import sys
import typing

import pytest_cases
from parameterized import parameterized
from pytest import fixture, mark

from . import conftest
from .helpers.pages import CartPage

if typing.TYPE_CHECKING:
    from shop.orders import Order

try:
    import orjson as json
except ImportError:
    import json

pytestmark = [mark.usefixtures("clean_env"), mark.xfail(reason="the order API is unstable in CI")]

API = "https://api.example.test"


def setup_module(module):
    module.started = True


def teardown_module(module):
    module.started = False


def setup_function(function):
    function.calls = 0


def teardown_function(function):
    function.calls = None


@fixture(scope="module")
def order(api_session):
    created = api_session.post(f"{API}/orders", json={"sku": "backpack"})
    yield created.json()
    api_session.delete(f"{API}/orders/{created.json()['id']}")
    # qa-core-review-disable-next-line QCR-W001 -- the delete is asynchronous on the server
    wait_for_delete()


@fixture
def cart_page(api_session):
    with CartPage(api_session, API) as page:
        yield page


def test_order_is_created(order):
    assert order["status"] == "created"


@mark.skip("the refund flow moves to another service")
def test_order_can_be_refunded(order, api_session):
    response = api_session.post(f"{API}/orders/{order['id']}/refund")
    assert response.status_code == 202


@pytest_cases.parametrize_with_cases("payload", cases=".cases_orders")
def test_invalid_order_is_rejected(payload, api_session):
    assert api_session.post(f"{API}/orders", json=payload).status_code == 422


@pytest_cases.parametrize("status", ["created", "paid", "shipped", "delivered"])
def test_status_is_known(status):
    assert status in conftest.KNOWN_STATUSES


@parameterized([("backpack", 1), ("bike-light", 2)])
def test_order_line(sku, quantity):
    assert json.loads(json.dumps({"sku": sku, "quantity": quantity}))["quantity"] == quantity


class TestOrderNumbers:
    @parameterized.expand([("A-1",), ("A-22",), ("B-333",)])
    def test_format(self, number):
        assert number.split("-")[0].isalpha()


if sys.platform != "win32":
    def test_export_uses_posix_paths(tmp_path):
        assert "/" in str(tmp_path / "orders.csv")
else:
    def test_export_uses_windows_paths(tmp_path):
        assert "\\" in str(tmp_path / "orders.csv")
