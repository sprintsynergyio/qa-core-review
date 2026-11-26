"""What a test does besides checking: waits, requests, mocks and the resources it takes."""
import asyncio
import os
import psycopg2
import sqlite3
import time
from unittest import mock
from unittest.mock import MagicMock, Mock, patch

import httpx
import pytest
import requests
import responses
import respx
import time_machine
from freezegun import freeze_time

from shop import checkout
from shop.checkout import Checkout, charge

API = "https://api.example.test"


def test_waits(api_session, cart):
    api_session.post(f"{API}/carts/{cart}/checkout")
    time.sleep(2)
    time.sleep(0.25)
    time.sleep(RETRY_DELAY)
    assert api_session.get(f"{API}/carts/{cart}").json()["status"] == "paid"


async def test_async_wait(client):
    await client.post("/checkout")
    await asyncio.sleep(1.5)
    assert (await client.get("/orders")).status_code == 200


@freeze_time("2026-01-01")
def test_fake_time():
    with freeze_time("2026-12-31"):
        assert Checkout().is_holiday_sale()
    with time_machine.travel("2026-07-01"):
        assert not Checkout().is_holiday_sale()


def test_requests_and_data(api_session, client, api, api_client, http, session, db):
    created = api_session.post(f"{API}/orders", json={"sku": "backpack"})
    api_session.put(f"{API}/orders/1", json={"quantity": 2})
    api_session.patch(f"{API}/orders/1", json={"quantity": 3})
    api_session.head(f"{API}/orders/1")
    assert client.get("/orders/1").status_code == 200
    assert requests.get(f"{API}/orders/1").ok
    assert httpx.get(f"{API}/orders/1").is_success
    api.delete("/orders/1")
    api_client.get("/orders")
    http.get("/health")
    session.get("/me")
    db.execute("INSERT INTO orders (sku) VALUES ('backpack')")
    db.execute("UPDATE orders SET quantity = 2")
    db.executemany("DELETE FROM orders WHERE id = ?", [(1,)])
    assert db.execute("SELECT count(*) FROM orders").fetchone()[0] == 0
    assert created.status_code == 201


def test_order_is_never_deleted(api_session):
    created = api_session.post(f"{API}/orders", json={"sku": "bike-light"})
    assert created.status_code == 201


@patch("shop.checkout.charge")
@patch("shop.checkout.send_receipt", return_value=True)
@mock.patch.object(Checkout, "total", return_value=42)
def test_patch_decorators(total, send_receipt, charged):
    assert Checkout().pay() == 42
    charged.assert_called_once()


def test_patch_forms(mocker):
    with patch("shop.checkout.requests.post") as post, patch.object(checkout, "charge", wraps=charge) as wrapped:
        post.return_value = Mock(status_code=200)
        Checkout().pay()
    wrapped.assert_called_once()
    gateway = mocker.patch("shop.checkout.gateway", new=FakeGateway())
    mocker.patch.object(Checkout, "tax", side_effect=[1, 2])
    spy = mocker.spy(Checkout, "total")
    fake = mocker.patch("shop.checkout.rates", {"EUR": 1.0})
    Checkout().pay()
    spy.assert_called_once()
    mocker.stopall()
    assert gateway and fake


def test_named_mocks(mocker):
    send = Mock()
    mailer = MagicMock(return_value=True)
    notify = mock.AsyncMock()
    spec = mock.create_autospec(Checkout)
    stub = mocker.stub()
    made = mocker.Mock()
    magic = mocker.MagicMock()
    send.return_value = 201
    notify.side_effect = RuntimeError("down")
    assert Checkout(mailer=mailer, on_paid=send).pay() == 201
    assert spec and stub and made and magic


def test_monkeypatch(monkeypatch):
    monkeypatch.setattr("shop.checkout.charge", lambda amount: True)
    monkeypatch.setattr(checkout, "send_receipt", fake_send)
    monkeypatch.setattr(Checkout, "tax", Mock(return_value=0))
    monkeypatch.setenv("SHOP_REGION", "eu")
    monkeypatch.delenv("SHOP_DEBUG", raising=False)
    assert Checkout().pay()


@responses.activate
def test_network_mocks(requests_mock, httpx_mock):
    responses.add(responses.GET, f"{API}/rates", json={"EUR": 1.0})
    responses.post("https://api.example.test/charge", json={"ok": True})
    respx.get("https://api.example.test/stock").mock(return_value=httpx.Response(200))
    respx.route(host="api.example.test").mock(return_value=httpx.Response(200))
    requests_mock.get("https://api.example.test/orders", json=[])
    requests_mock.register_uri("GET", "https://api.example.test/health", text="ok")
    requests_mock.put("https://api.example.test/orders/1", json={})
    requests_mock.patch("https://api.example.test/orders/1", json={})
    requests_mock.delete("https://api.example.test/orders/1", status_code=204)
    requests_mock.head("https://api.example.test/orders/1")
    httpx_mock.add_response(url="https://api.example.test/taxes", json={"rate": 0.19})
    assert Checkout().pay()


def test_resources_that_leak(tmp_path, capsys):
    os.environ["SHOP_REGION"] = "us"
    log = open(tmp_path / "checkout.log", "w")
    database = sqlite3.connect(":memory:")
    warehouse = psycopg2.connect("dbname=shop")
    http_session = requests.Session()
    client = httpx.Client(base_url=API)
    patcher = patch("shop.checkout.charge")
    patcher.start()
    patch("shop.checkout.send_receipt").start()
    Checkout(log=log, db=database, http=http_session, client=client).pay()
    assert "paid" in capsys.readouterr().out


def test_resources_that_are_released(tmp_path, request):
    os.environ["SHOP_CURRENCY"] = "EUR"
    database = sqlite3.connect(":memory:")
    request.addfinalizer(database.close)
    http_session = requests.Session()
    patcher = patch("shop.checkout.charge")
    patcher.start()
    patch("shop.checkout.send_receipt").start()
    try:
        with open(tmp_path / "checkout.log", "w") as log, httpx.Client(base_url=API) as client:
            Checkout(log=log, db=database, http=http_session, client=client).pay()
    finally:
        http_session.close()
        patcher.stop()
        patch.stopall()
        del os.environ["SHOP_CURRENCY"]
    assert log.closed


def test_environment_is_put_back():
    os.environ["SHOP_TAX"] = "19"
    assert Checkout().tax() == 19
    os.environ.pop("SHOP_TAX")


@patch("shop.checkout.charge", return_value=42)
def test_stubs_what_it_tests(charged):
    assert charge(40, 2) == 42


@patch("shop.checkout.Checkout")
def test_replaces_the_class_under_test(checkout_class):
    assert Checkout().total() == 42


@patch("shop.checkout.tax_rate", return_value=0)
def test_stubs_a_dependency(tax_rate):
    assert Checkout([40, 2]).total() == 42


def test_replaces_the_module_under_test(mocker):
    mocker.patch("shop.checkout")
    assert checkout.charge(40, 2) == 42
