import asyncio

import pytest
from playwright.async_api import Page, expect


@pytest.mark.asyncio
async def test_checkout_shows_the_total(page: Page):
    await page.goto("https://www.saucedemo.com/checkout-step-two.html")
    await asyncio.sleep(2)  # expect: QCR-W001
    await expect(page.get_by_test_id("total-label")).to_contain_text("$32.39")


@pytest.mark.asyncio
async def test_finish_shows_the_thanks(page: Page):
    await page.goto("https://www.saucedemo.com/checkout-step-two.html")
    await page.get_by_role("button", name="Finish").click()
    await page.wait_for_timeout(500)  # expect: QCR-W001
    await expect(page.get_by_role("heading", name="Thank you for your order!")).to_be_visible()
