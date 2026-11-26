from playwright.sync_api import Page, expect


def test_adds_the_bike_light(page: Page):
    page.goto("https://www.saucedemo.com/inventory.html")
    page.get_by_test_id("add-to-cart-sauce-labs-bike-light").click()
    expect(page.get_by_test_id("shopping-cart-badge")).to_have_text("1")


def test_checkout_button(page: Page):
    page.goto("https://www.saucedemo.com/cart.html")
    page.get_by_role("button", name="Checkout").click()
    expect(page).to_have_url("https://www.saucedemo.com/checkout-step-one.html")


def test_login_label(page: Page):
    page.goto("https://www.saucedemo.com")
    expect(page.get_by_label("Username")).to_be_visible()
