from playwright.sync_api import Page, expect


def test_adds_backpack_to_cart(page: Page):
    page.goto("https://www.saucedemo.com/inventory.html")
    page.get_by_role("button", name="Add to cart").click()
    # The assertion waits by itself until the badge shows 1.
    expect(page.get_by_test_id("shopping-cart-badge")).to_have_text("1")
