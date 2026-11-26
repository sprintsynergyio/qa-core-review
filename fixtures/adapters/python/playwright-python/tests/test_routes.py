"""Network routes, waits for a condition, page actions with a selector, and browsers started by hand."""
import pytest
from playwright.sync_api import Page, expect, sync_playwright

BASE = "https://www.saucedemo.com"


def answer_with_empty_cart(route):
    route.fulfill(json={"items": []})


def test_routes(page: Page):
    page.route("**/api/cart", lambda route: route.fulfill(json={"items": []}))
    page.route("**/api/prices", answer_with_empty_cart)
    page.route("**/*.png", lambda route: route.abort())
    page.route("**/api/health", lambda route: route.continue_())
    page.route("**/api/user", lambda route: route.fallback())
    page.route("**/*", lambda route: route.fulfill(status=200, body="{}"))
    page.route("**", lambda route: route.fulfill(status=200))
    page.route("*", lambda route: route.fulfill(status=200))
    page.goto(f"{BASE}/cart.html")
    expect(page.locator(".cart_item")).to_have_count(0)


def test_condition_waits(page: Page):
    page.goto(BASE)
    page.wait_for_selector("#login-button")
    page.wait_for_url("**/index.html")
    page.wait_for_load_state("networkidle")
    page.locator("#login-button").wait_for(state="visible")
    page.wait_for_timeout(1500)
    assert page.query_selector_all(".login_logo")


def test_page_actions_with_a_selector(page: Page, frame, popup, checkout_page):
    page.goto(BASE)
    page.fill("#user-name", "standard_user")
    page.type("#password", "secret_sauce")
    page.press("#password", "Enter")
    page.click("text=Open Menu")
    page.dblclick("[data-testid='logo']")
    page.hover("[data-qa='menu']")
    page.check("[data-cy='terms']")
    page.uncheck("[data-test='newsletter']")
    page.select_option("select.product_sort_container", "lohi")
    assert page.is_visible("#inventory_container")
    assert page.text_content(".title") == "Products"
    assert page.inner_text(".title") == "Products"
    frame.click("#accept")
    popup.click("#close")
    checkout_page.click("#finish")
    page.reload()
    page.go_back()
    page.locator("li").nth(2).click()
    page.locator("li").first.dblclick()
    page.locator("li").last.hover()
    page.locator("#terms").check()
    page.locator("#terms").uncheck()
    page.locator("#name").fill("Ada")
    page.locator("#name").type("!")
    page.locator("#name").press("Enter")
    page.locator("select").select_option("az")
    page.frame_locator("#ads").locator("a").click()


def test_browser_started_by_hand():
    playwright = sync_playwright().start()
    browser = playwright.chromium.launch()
    context = browser.new_context()
    page = context.new_page()
    page.goto(BASE)
    assert page.title() == "Swag Labs"


def test_browser_closed_again():
    playwright = sync_playwright().start()
    browser = playwright.chromium.launch()
    page = browser.new_page()
    try:
        page.goto(BASE)
        assert page.title() == "Swag Labs"
    finally:
        browser.close()
        playwright.stop()


@pytest.mark.asyncio
async def test_async_browser():
    from playwright.async_api import async_playwright

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch()
        page = await browser.new_page()
        await page.goto(BASE)
        assert await page.title() == "Swag Labs"
        await browser.aclose()


def test_page_from_the_context_fixture(context, browser):
    page = context.new_page()
    other = browser.new_context()
    page.goto(BASE)
    assert other.pages == []
