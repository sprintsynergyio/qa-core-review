"""Every Playwright matcher, the calls that give a locator, and assertions that cannot fail."""
import re

from playwright.sync_api import ElementHandle, Locator, Page, expect

BASE = "https://www.saucedemo.com"


def test_page_matchers(page: Page):
    page.goto(f"{BASE}/inventory.html")
    expect(page).to_have_title("Swag Labs")
    expect(page).to_have_url(re.compile(r"inventory"))
    expect(page.request.get(f"{BASE}/inventory.html")).to_be_ok()


def test_state_matchers(page: Page):
    page.goto(BASE)
    username = page.get_by_placeholder("Username")
    expect(username).to_be_attached()
    expect(username).to_be_visible()
    expect(username).to_be_enabled()
    expect(username).to_be_editable()
    expect(username).to_be_empty()
    username.focus()
    expect(username).to_be_focused()
    expect(username).to_be_in_viewport()
    expect(page.get_by_role("checkbox")).to_be_checked()
    expect(page.get_by_role("button", name="Login")).not_to_be_disabled()
    expect(page.get_by_text("Epic sadface")).to_be_hidden()
    expect(page.locator("#login-button")).to_be_disabled()
    expect(page.locator("#login-button")).not_to_be_attached()


def test_content_matchers(page: Page):
    page.goto(f"{BASE}/inventory.html")
    title = page.get_by_title("Products")
    expect(title).to_have_text("Products")
    expect(title).to_contain_text("Prod")
    expect(page.get_by_label("Sort")).to_have_value("az")
    expect(page.get_by_label("Sort")).to_have_values(["az"])
    expect(page.get_by_alt_text("Sauce Labs Backpack")).to_have_attribute("src", re.compile(r"\.jpg$"))
    expect(page.get_by_test_id("inventory-container")).to_have_class(re.compile("inventory_container"))
    expect(page.get_by_test_id("inventory-container")).to_have_css("display", "block")
    expect(page.get_by_test_id("inventory-container")).to_have_id("inventory_container")
    expect(page.get_by_role("button").first).to_have_role("button")
    expect(page.get_by_role("button").last).to_have_accessible_name("Add to cart")
    expect(page.locator(".inventory_item")).to_have_count(6)
    expect(page.frame_locator("#ads").locator("a").nth(0)).not_to_be_visible()
    expect(page.locator(".inventory_item").filter(has_text="Backpack")).to_have_count(1)


def test_assertions_that_cannot_fail(page: Page):
    page.goto(f"{BASE}/inventory.html")
    badge: Locator = page.locator(".shopping_cart_badge")
    handle: ElementHandle = page.query_selector(".shopping_cart_link")
    assert badge
    assert page.locator(".shopping_cart_badge") is not None
    assert handle
    assert page.locator(".inventory_item").count() >= 0
    expect(badge)
    expect(badge).to_be_visible
    assert page.locator(".inventory_item").count() == 6
