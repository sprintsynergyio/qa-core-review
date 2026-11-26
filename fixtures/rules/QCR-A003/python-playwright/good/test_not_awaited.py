import pytest
from playwright.async_api import Page, expect


@pytest.mark.asyncio
async def test_checkout_button_is_shown(page: Page):
    await page.goto("https://www.saucedemo.com/cart.html")
    await expect(page.get_by_role("button", name="Checkout")).to_be_visible()


@pytest.mark.asyncio
async def test_cart_badge_counts_one_item(page: Page):
    await page.goto("https://www.saucedemo.com/inventory.html")
    await page.locator("[data-test='add-to-cart-sauce-labs-backpack']").click()
    await expect(page.locator("[data-test='shopping-cart-badge']")).to_have_text("1")
