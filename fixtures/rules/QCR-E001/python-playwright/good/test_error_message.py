from playwright.sync_api import Page, TimeoutError, expect


def test_locked_user_sees_an_error(page: Page):
    page.goto("https://www.saucedemo.com")
    page.get_by_placeholder("Username").fill("locked_out_user")
    page.get_by_placeholder("Password").fill("secret_sauce")
    try:
        page.get_by_role("button", name="Login").click(timeout=2000)
    except TimeoutError:
        # Only the click is retried. The check is outside the try block.
        page.get_by_role("button", name="Login").click()
    expect(page.get_by_test_id("error")).to_contain_text("locked out")
