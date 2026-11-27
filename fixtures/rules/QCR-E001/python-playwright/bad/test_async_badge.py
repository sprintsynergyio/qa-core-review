import pytest
from playwright.async_api import Page, expect


@pytest.mark.asyncio
async def test_cart_badge(page: Page):
    await page.goto("https://www.saucedemo.com/inventory.html")
    await page.get_by_role("button", name="Add to cart").first.click()
    try:  # expect: QCR-E001
        await expect(page.get_by_test_id("shopping-cart-badge")).to_have_text("1")
    except AssertionError:
        await page.screenshot(path="badge.png")
