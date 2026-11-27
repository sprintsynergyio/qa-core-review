from playwright.sync_api import Browser, expect


def test_two_users_see_their_own_cart(browser: Browser):
    first = browser.new_context()  # expect: QCR-C001
    second = browser.new_context()  # expect: QCR-C001
    one = first.new_page()  # expect: QCR-C001
    two = second.new_page()  # expect: QCR-C001
    one.goto("https://www.saucedemo.com/cart.html")
    two.goto("https://www.saucedemo.com/cart.html")
    expect(one.get_by_test_id("cart-list")).to_be_visible()
    expect(two.get_by_test_id("cart-list")).to_be_visible()
