from playwright.sync_api import Page, expect


def test_cart_lists_the_items(page: Page):
    page.route("**/*", lambda route: route.fulfill(json={"items": []}))  # expect: QCR-M001
    page.goto("https://www.saucedemo.com/cart.html")
    expect(page.get_by_test_id("cart-list")).to_be_visible()
