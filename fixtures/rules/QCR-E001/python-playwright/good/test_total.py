from playwright.sync_api import Page, expect


def test_order_total(page: Page):
    page.goto("https://www.saucedemo.com/checkout-step-two.html")
    expect(page.get_by_test_id("total")).to_have_text("$32.39")
