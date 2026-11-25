"""Cart tests: plain functions, marks, parametrize and test classes."""
import sys

import pytest

from shop.cart import Cart, total as cart_total

API = "https://api.example.test"


def test_new_cart_is_empty():
    """A new cart has no items."""
    cart = Cart()
    assert cart.items == []
    assert cart_total(cart) == 0


@pytest.mark.parametrize("quantity, expected", [(1, 29.99), (2, 59.98), (3, 89.97)])
def test_total_grows_with_quantity(quantity, expected):
    cart = Cart()
    cart.add("backpack", quantity)
    assert cart.total() == pytest.approx(expected)


@pytest.mark.parametrize("sku", ["backpack", "bike-light"])
@pytest.mark.parametrize("region", ["eu", "us", "uk"], ids=["europe", "america", "britain"])
def test_price_exists_in_every_region(sku, region):
    assert Cart(region=region).price_of(sku) > 0


@pytest.mark.parametrize("sku", load_skus())
def test_every_sku_can_be_added(sku):
    cart = Cart()
    cart.add(sku)
    assert sku in cart.items


@pytest.mark.skip(reason="the coupon service is being replaced")
def test_coupon_lowers_the_total():
    cart = Cart()
    cart.add("backpack")
    cart.apply_coupon("WELCOME10")
    assert cart.total() == 26.99


@pytest.mark.skip
def test_gift_wrap():
    assert Cart().gift_wrap() is True


@pytest.mark.skipif(sys.platform == "win32", reason="the receipt printer driver is POSIX only")
def test_receipt_is_printed(tmp_path):
    receipt = Cart().print_receipt(tmp_path / "receipt.txt")
    assert receipt.exists()


@pytest.mark.xfail(reason="rounding bug SHOP-212", strict=True)
def test_total_is_rounded_to_cents():
    cart = Cart()
    cart.add("bike-light", 3)
    assert cart.total() == 29.97


def test_stock_is_checked(cart, api_session):
    if not api_session.get(f"{API}/stock/health").ok:
        pytest.skip("the stock service is down")
    response = api_session.post(f"{API}/carts/{cart}/items", json={"sku": "backpack", "quantity": 999})
    assert response.status_code == 409


def test_loyalty_points():
    pytest.skip(msg="needs the staging database")
    assert Cart().points() == 10


def test_export_to_spreadsheet(tmp_path):
    openpyxl = pytest.importorskip("openpyxl")
    path = Cart().export(tmp_path / "cart.xlsx")
    assert openpyxl.load_workbook(path).active.max_row == 1


async def test_async_checkout(cart, api_session):
    response = await api_session.post_async(f"{API}/carts/{cart}/checkout")
    assert response.status_code == 201


def test_placeholder():
    pass


def test_todo_later():
    """Written when the returns flow is ready."""
    ...


def test_remove_item():
    def add_two(target):
        target.add("backpack")
        target.add("bike-light")

    cart = Cart()
    add_two(cart)
    cart.remove("backpack")
    # Only the light is left.
    assert cart.items == ["bike-light"]


class TestCartDiscounts:
    """Discount rules."""

    @classmethod
    def setup_class(cls):
        cls.rates = {"WELCOME10": 0.1, "VIP20": 0.2}

    @classmethod
    def teardown_class(cls):
        cls.rates = None

    def setup_method(self, method):
        self.cart = Cart()
        self.cart.add("backpack")

    def teardown_method(self, method):
        self.cart.clear()

    def test_welcome_discount(self):
        self.cart.apply_coupon("WELCOME10")
        assert self.cart.total() == 26.99

    def test_unknown_coupon_is_rejected(self):
        with pytest.raises(ValueError, match="unknown coupon"):
            self.cart.apply_coupon("NOPE")

    def helper_not_a_test(self):
        return self.cart.total()

    class TestStacking:
        def test_two_coupons_do_not_stack(self):
            cart = Cart()
            cart.add("backpack")
            cart.apply_coupon("WELCOME10")
            with pytest.raises(ValueError):
                cart.apply_coupon("VIP20")


@pytest.mark.parametrize("currency", ["EUR", "USD"])
class TestCurrencies:
    def test_symbol(self, currency):
        assert Cart(currency=currency).symbol() in {"€", "$"}

    @pytest.mark.parametrize("amount", [0, 1, 100])
    def test_format(self, currency, amount):
        assert Cart(currency=currency).format(amount).endswith(currency)


@pytest.mark.skip(reason="the wishlist is not released yet")
class TestWishlist:
    pytestmark = pytest.mark.xfail

    def test_add_to_wishlist(self):
        assert Cart().wishlist == []


class CartFactory:
    """Not a test class: the name does not start with Test."""

    def test_like_name_is_ignored(self):
        return Cart()
