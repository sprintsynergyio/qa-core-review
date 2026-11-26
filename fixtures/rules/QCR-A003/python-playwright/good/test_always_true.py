from playwright.sync_api import Page, expect


def test_checkout_button_exists(page: Page):
    page.goto("https://www.saucedemo.com/cart.html")
    expect(page.locator("#checkout")).to_be_visible()


def test_products_are_listed(page: Page):
    page.goto("https://www.saucedemo.com/inventory.html")
    assert page.locator(".inventory_item").count() == 6
    expect(page.get_by_text("Products")).to_be_visible()
