from playwright.sync_api import Page, expect


def test_third_item_is_the_bolt_shirt(page: Page):
    page.goto("https://www.saucedemo.com/inventory.html")
    expect(page.locator(".inventory_item_name").nth(2)).to_have_text("Sauce Labs Bolt T-Shirt")  # expect: QCR-S001


def test_first_and_last_prices(page: Page):
    page.goto("https://www.saucedemo.com/inventory.html")
    expect(page.locator(".inventory_item_price").first).to_have_text("$29.99")  # expect: QCR-S001
    expect(page.locator(".inventory_item_price").last).to_have_text("$15.99")  # expect: QCR-S001
