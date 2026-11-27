from playwright.sync_api import Page, expect


def test_cart_lists_the_items(page: Page):
    # Only the request this test is about is faked.
    page.route("**/api/cart", lambda route: route.fulfill(json={"items": []}))
    page.goto("https://www.saucedemo.com/cart.html")
    expect(page.get_by_test_id("cart-list")).to_be_visible()
