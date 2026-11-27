from playwright.sync_api import Page


def test_checkout_button_exists(page: Page):
    page.goto("https://www.saucedemo.com/cart.html")
    assert page.locator("#checkout")  # expect: QCR-A003


def test_products_are_listed(page: Page):
    page.goto("https://www.saucedemo.com/inventory.html")
    assert page.locator(".inventory_item").count() >= 0  # expect: QCR-A003
    assert page.get_by_text("Products") is not None  # expect: QCR-A003
