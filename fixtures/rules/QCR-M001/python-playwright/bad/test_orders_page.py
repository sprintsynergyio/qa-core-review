from playwright.sync_api import BrowserContext, Page, expect


def test_orders_page_shows_one_order(context: BrowserContext, page: Page):
    context.route("**/*", lambda route: route.fulfill(json=[{"id": 7, "status": "placed"}]))  # expect: QCR-M001
    page.goto("https://www.saucedemo.com/orders.html")
    expect(page.get_by_role("row")).to_have_count(2)
