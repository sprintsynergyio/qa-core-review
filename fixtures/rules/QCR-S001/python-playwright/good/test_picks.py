from playwright.sync_api import Page, expect


def test_bolt_shirt_is_listed(page: Page):
    page.goto("https://www.saucedemo.com/inventory.html")
    expect(page.locator(".inventory_item_name").filter(has_text="Sauce Labs Bolt T-Shirt")).to_be_visible()


def test_first_button_adds_to_the_cart(page: Page):
    page.goto("https://www.saucedemo.com/inventory.html")
    # The first match of a role with a name is a stable pick.
    page.get_by_role("button", name="Add to cart").first.click()
    expect(page.get_by_test_id("shopping-cart-badge")).to_have_text("1")
