import pytest
from playwright.async_api import async_playwright, expect


@pytest.mark.asyncio
async def test_opens_the_login_page():
    async with async_playwright() as playwright:
        browser = await playwright.firefox.launch()
        page = await browser.new_page()
        # The block stops Playwright at its end, and the browser and the page with it.
        await page.goto("https://www.saucedemo.com")
        await expect(page.get_by_role("button", name="Login")).to_be_visible()
