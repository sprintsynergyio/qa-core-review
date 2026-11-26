from playwright.sync_api import Page, expect


def test_opens_the_shop(page: Page):
    # The page fixture of pytest-playwright is closed by the runner.
    page.goto("https://www.saucedemo.com")
    expect(page).to_have_title("Swag Labs")
