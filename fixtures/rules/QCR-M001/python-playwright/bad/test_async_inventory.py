import pytest
from playwright.async_api import Page, Route, expect


async def empty_shop(route: Route):
    await route.fulfill(json={"products": []})


@pytest.mark.asyncio
async def test_inventory_shows_the_title(page: Page):
    await page.route("**", empty_shop)  # expect: QCR-M001
    await page.goto("https://www.saucedemo.com/inventory.html")
    await expect(page.get_by_text("Products")).to_be_visible()
