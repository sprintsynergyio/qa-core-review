import pytest
from playwright.async_api import async_playwright, expect


@pytest.mark.asyncio
async def test_opens_the_login_page():
    playwright = await async_playwright().start()  # expect: QCR-C001
    browser = await playwright.firefox.launch()  # expect: QCR-C001
    page = await browser.new_page()  # expect: QCR-C001
    await page.goto("https://www.saucedemo.com")
    await expect(page.get_by_role("button", name="Login")).to_be_visible()
