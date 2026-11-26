import time

from playwright.sync_api import Page, expect


def test_logs_in(page: Page):
    page.goto("https://www.saucedemo.com")
    page.get_by_placeholder("Username").fill("standard_user")
    page.get_by_placeholder("Password").fill("secret_sauce")
    page.get_by_role("button", name="Login").click()
    time.sleep(1)  # expect: QCR-W001
    expect(page).to_have_url("https://www.saucedemo.com/inventory.html")
