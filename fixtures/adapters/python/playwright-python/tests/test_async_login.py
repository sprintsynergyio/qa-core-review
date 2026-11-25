"""Login tests with the async API of Playwright for Python."""
import pytest
import pytest_asyncio
from playwright.async_api import async_playwright, expect

BASE = "https://www.saucedemo.com"


@pytest_asyncio.fixture
async def page():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch()
        page = await browser.new_page()
        yield page
        await browser.close()


@pytest.mark.asyncio
async def test_locked_out_user_sees_an_error(page):
    await page.goto(BASE)
    await page.get_by_placeholder("Username").fill("locked_out_user")
    await page.get_by_placeholder("Password").fill("secret_sauce")
    await page.get_by_role("button", name="Login").click()
    await expect(page.locator("[data-test='error']")).to_contain_text("locked out")


@pytest.mark.asyncio
async def test_error_can_be_closed(page):
    await page.goto(BASE)
    await page.get_by_role("button", name="Login").click()
    await page.locator(".error-button").click()
    expect(page.locator("[data-test='error']")).to_be_hidden()
