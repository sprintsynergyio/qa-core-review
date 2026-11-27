from playwright.sync_api import Browser, expect


def test_two_users_see_their_own_cart(browser: Browser):
    first = browser.new_context()
    second = browser.new_context()
    try:
        one = first.new_page()
        two = second.new_page()
        one.goto("https://www.saucedemo.com/cart.html")
        two.goto("https://www.saucedemo.com/cart.html")
        expect(one.get_by_test_id("cart-list")).to_be_visible()
        expect(two.get_by_test_id("cart-list")).to_be_visible()
    finally:
        first.close()
        second.close()
