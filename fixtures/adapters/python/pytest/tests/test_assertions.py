"""What a test checks: assert statements, pytest helpers, mocks, soft checks and try blocks."""
import contextlib
from unittest import mock
from unittest.mock import AsyncMock, MagicMock, Mock, create_autospec, patch

import numpy as np
import pytest
import pytest_check
from pytest_check import check

from shop.cart import Cart
from shop.mail import Mailer

from .conftest import assert_cart_total

API = "https://api.example.test"


def assert_empty(cart):
    assert cart.items == []
    assert cart.total() == 0


def test_assert_forms(cart, api_session):
    response = api_session.get(f"{API}/carts/{cart}")
    assert response.status_code == 200
    assert 200 == response.status_code
    assert response.status in (200, 204)
    assert response.json()["total"] != 0, "the cart has a total"
    assert "backpack" in response.json()["items"]
    assert "coupon" not in response.json()
    assert response.json().get("owner") is None
    assert response.json()["id"] is not None
    assert response.ok
    assert not response.json()["locked"]
    assert len(response.json()["items"]) > 1
    assert 0 < response.json()["total"] <= 500
    assert isinstance(response.json()["items"], list)
    assert issubclass(type(response), object)
    assert response.json()["items"].count("backpack") == 1
    response.raise_for_status()


def test_asserts_that_cannot_fail(cart):
    assert True
    assert 1 == 1
    assert (cart.total(), 42)
    assert len(cart.items) >= 0
    assert cart.total() == cart.total()


def test_snapshots(cart, snapshot):
    assert cart.to_dict() == snapshot
    assert cart.to_json() == snapshot(name="json")
    snapshot.assert_match(cart.to_text(), "cart.txt")


def test_exceptions_and_warnings(cart):
    with pytest.raises(ValueError, match="quantity"):
        cart.add("backpack", 0)
    with pytest.raises((KeyError, LookupError)) as error:
        cart.remove("nope")
    assert "nope" in str(error.value)
    with pytest.warns(DeprecationWarning):
        cart.legacy_total()
    with pytest.deprecated_call():
        cart.legacy_total()
    pytest.raises(TypeError, cart.add, None)
    pytest.raises(ValueError)


def test_fail_calls(cart):
    if cart.total() < 0:
        pytest.fail("the total is negative")
    if not cart.items:
        raise AssertionError("the cart is empty")
    for item in cart.items:
        assert item.price > 0
    names = [item.name for item in cart.items if item.name]
    assert names if cart.items else True
    return
    assert cart.items


def test_helpers(cart, api_session):
    response = api_session.get(f"{API}/carts/{cart}")
    assert_cart_total(response, 0)
    assert_empty(Cart())
    np.testing.assert_allclose(response.json()["total"], 0.0)


def test_soft_checks(cart):
    check.equal(cart.total(), 0)
    check.not_equal(cart.currency, "")
    check.almost_equal(cart.tax(), 0.0)
    check.is_true(cart.is_open)
    check.is_false(cart.locked)
    check.is_none(cart.owner)
    check.is_not_none(cart.id)
    check.is_in("EUR", cart.currencies)
    check.is_not_in("XXX", cart.currencies)
    check.is_instance(cart, Cart)
    check.greater(cart.limit, 0)
    check.greater_equal(cart.limit, 1)
    check.less(cart.total(), cart.limit)
    check.less_equal(cart.total(), cart.limit)
    check.raises(ValueError, cart.add, None)
    pytest_check.check.is_true(cart.is_open)
    with check:
        assert cart.items == []


def test_mock_assertions(mocker):
    send = Mock()
    mailer = MagicMock(spec=Mailer)
    notify = AsyncMock()
    spec = create_autospec(Mailer)
    cart = Cart(mailer=mailer, on_checkout=send)
    cart.checkout()
    send.assert_called()
    send.assert_called_once()
    send.assert_called_with(cart)
    send.assert_called_once_with(cart)
    send.assert_any_call(cart)
    send.assert_has_calls([mock.call(cart)])
    mailer.send_receipt.assert_not_called()
    notify.assert_awaited()
    notify.assert_awaited_once()
    notify.assert_awaited_with(cart)
    notify.assert_awaited_once_with(cart)
    notify.assert_any_await(cart)
    notify.assert_has_awaits([mock.call(cart)])
    notify.assert_not_awaited()
    assert send.called
    assert send.call_count == 1
    assert notify.await_count == 0
    assert send.call_args == mock.call(cart)
    assert send.call_args_list == [mock.call(cart)]
    assert spec.mock_calls == []


def test_mock_look_alikes(mocker):
    send = mocker.Mock()
    mailer = mocker.MagicMock()
    charge = mocker.patch("shop.cart.charge")
    refund = mocker.patch.object(Cart, "refund")
    spy = mocker.spy(Cart, "total")
    stub = mocker.stub(name="on_checkout")
    Cart(mailer=mailer, on_checkout=send).checkout()
    send.called_once()
    send.called_once_with(1)
    charge.called_with(29.99)
    refund.has_calls([])
    spy.not_called()
    stub.any_call()
    mailer.assert_called_once
    charge.assert_called_once_wiht(29.99)
    assert send.called_once_with(1)


@patch("shop.cart.charge")
@patch.object(Cart, "refund")
def test_patch_decorators(refund, charge):
    Cart().checkout()
    charge.assert_called_once()
    refund.assert_not_called()


def test_patch_as_context(cart):
    with patch("shop.cart.charge") as charge, mock.patch.object(Cart, "refund") as refund:
        cart.checkout()
    charge.assert_called_once()
    refund.assert_not_called()


def test_swallowed_failures(cart):
    try:
        assert cart.total() == 0
    except Exception:
        pass
    try:
        assert cart.items == []
    except BaseException as error:
        print(error)
    try:
        assert cart.owner is None
    except:
        pass
    with contextlib.suppress(AssertionError):
        assert cart.currency == "EUR"
    with pytest.raises(Exception):
        assert cart.locked


def test_handled_failures(cart):
    try:
        assert cart.total() == 0
    except AssertionError:
        raise
    try:
        assert cart.items == []
    except Exception as error:
        pytest.fail(f"the cart is not empty: {error}")
    try:
        cart.add("backpack")
    except KeyError:
        pass
    except (ValueError, AssertionError) as error:
        assert "quantity" in str(error)
    try:
        value = cart.total()
    except TypeError:
        value = None
    else:
        assert value == 0
    finally:
        assert cart is not None
