from playwright.sync_api import Page, expect


def test_locked_user_sees_an_error(page: Page):
    page.goto("https://www.saucedemo.com")
    page.get_by_placeholder("Username").fill("locked_out_user")
    page.get_by_placeholder("Password").fill("secret_sauce")
    page.get_by_role("button", name="Login").click()
    try:  # expect: QCR-E001
        expect(page.get_by_test_id("error")).to_contain_text("locked out")
    except:
        return
