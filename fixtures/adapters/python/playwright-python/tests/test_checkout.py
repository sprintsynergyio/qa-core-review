"""Checkout tests with the sync API of Playwright for Python."""
import re

import pytest
from playwright.sync_api import Page, expect

BASE = "https://www.saucedemo.com"


@pytest.fixture(scope="class")
def logged_in_page(browser):
    context = browser.new_context()
    page = context.new_page()
    page.goto(BASE)
    page.get_by_placeholder("Username").fill("standard_user")
    page.get_by_placeholder("Password").fill("secret_sauce")
    page.get_by_role("button", name="Login").click()
    yield page
    context.close()


def test_login_shows_the_inventory(page: Page):
    page.goto(BASE)
    page.locator("#user-name").fill("standard_user")
    page.locator("#password").fill("secret_sauce")
    page.locator("#login-button").click()
    expect(page).to_have_url(re.compile(r"/inventory\.html$"))
    expect(page.get_by_text("Products")).to_be_visible()


def test_add_to_cart_shows_the_badge(logged_in_page: Page):
    logged_in_page.get_by_test_id("add-to-cart-sauce-labs-backpack").click()
    logged_in_page.wait_for_timeout(500)
    expect(logged_in_page.locator(".shopping_cart_badge")).to_have_text("1")


@pytest.mark.skip(reason="the sort menu is being redesigned")
def test_sort_by_price(logged_in_page: Page):
    logged_in_page.locator("select.product_sort_container").select_option("lohi")
    first = logged_in_page.locator("//div[@class='inventory_item_price']").first
    expect(first).to_have_text("$7.99")


class TestCheckout:
    @pytest.mark.parametrize("first_name, last_name, postal_code", [("", "Doe", "12345"), ("Ada", "", "12345"), ("Ada", "Doe", "")])
    def test_missing_field_shows_an_error(self, logged_in_page: Page, first_name, last_name, postal_code):
        logged_in_page.goto(f"{BASE}/checkout-step-one.html")
        logged_in_page.get_by_placeholder("First Name").fill(first_name)
        logged_in_page.get_by_placeholder("Last Name").fill(last_name)
        logged_in_page.get_by_placeholder("Zip/Postal Code").fill(postal_code)
        logged_in_page.get_by_role("button", name="Continue").click()
        expect(logged_in_page.locator("[data-test='error']")).to_be_visible()
