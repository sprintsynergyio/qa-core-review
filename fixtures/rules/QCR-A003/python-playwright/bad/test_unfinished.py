from playwright.sync_api import Page, expect


def test_title_is_shown(page: Page):
    page.goto("https://www.saucedemo.com/inventory.html")
    expect(page.get_by_text("Products"))  # expect: QCR-A003


def test_error_is_shown(page: Page):
    page.goto("https://www.saucedemo.com")
    page.get_by_role("button", name="Login").click()
    expect(page.locator("[data-test='error']")).to_be_visible  # expect: QCR-A003
