from playwright.sync_api import Page, expect


def test_adds_the_backpack(page: Page):
    page.goto("https://www.saucedemo.com/inventory.html")
    page.locator("[data-test='add-to-cart-sauce-labs-backpack']").click()
    expect(page.get_by_test_id("shopping-cart-badge")).to_have_text("1")


def test_opens_the_cart(page: Page):
    page.goto("https://www.saucedemo.com/inventory.html")
    page.click("#shopping_cart_container a")
    expect(page).to_have_url("https://www.saucedemo.com/cart.html")
