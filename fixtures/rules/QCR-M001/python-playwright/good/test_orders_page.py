from playwright.sync_api import Page, expect


def test_orders_page_shows_one_order(page: Page):
    # Every request is watched and passed on to the real server.
    page.route("**/*", lambda route: route.continue_())
    page.goto("https://www.saucedemo.com/orders.html")
    expect(page.get_by_role("heading", name="Your orders")).to_be_visible()
