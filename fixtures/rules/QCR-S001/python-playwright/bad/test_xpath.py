from playwright.sync_api import Page, expect


def test_adds_the_second_item(page: Page):
    page.goto("https://www.saucedemo.com/inventory.html")
    page.locator("//div[3]/div[2]/button[2]").click()  # expect: QCR-S001
    expect(page.get_by_test_id("shopping-cart-badge")).to_have_text("1")


def test_opens_the_cart(page: Page):
    page.goto("https://www.saucedemo.com/inventory.html")
    page.click("xpath=/html/body/div[1]/div/div[1]/a")  # expect: QCR-S001
    expect(page).to_have_url("https://www.saucedemo.com/cart.html")
