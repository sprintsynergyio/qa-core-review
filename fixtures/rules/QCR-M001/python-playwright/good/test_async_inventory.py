import pytest
from playwright.async_api import Page, Route, expect


async def without_pictures(route: Route):
    await route.abort()


@pytest.mark.asyncio
async def test_inventory_shows_the_title(page: Page):
    await page.route("**/*.jpg", without_pictures)
    await page.goto("https://www.saucedemo.com/inventory.html")
    await expect(page.get_by_text("Products")).to_be_visible()
