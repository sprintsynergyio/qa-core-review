from playwright.sync_api import Page, expect


def test_title_is_shown(page: Page):
    page.goto("https://www.saucedemo.com/inventory.html")
    # In the sync API an expect needs no await.
    expect(page.get_by_text("Products")).to_be_visible()


def test_error_is_shown(page: Page):
    page.goto("https://www.saucedemo.com")
    page.get_by_role("button", name="Login").click()
    expect(page.locator("[data-test='error']")).to_contain_text("Username is required")
