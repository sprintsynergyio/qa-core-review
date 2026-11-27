from playwright.sync_api import Page, expect


def test_adds_the_second_item(page: Page):
    page.goto("https://www.saucedemo.com/inventory.html")
    page.locator(".inventory_list > div:nth-child(2) button").click()  # expect: QCR-S001
    expect(page.get_by_test_id("shopping-cart-badge")).to_have_text("1")


def test_checkout_button(page: Page):
    page.goto("https://www.saucedemo.com/cart.html")
    page.locator("#root > div > main > section > button").click()  # expect: QCR-S001
    expect(page).to_have_url("https://www.saucedemo.com/checkout-step-one.html")


def test_banner_is_shown(page: Page):
    page.goto("https://www.saucedemo.com")
    expect(page.locator(".css-1q2w3e4")).to_be_visible()  # expect: QCR-S001
