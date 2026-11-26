from playwright.sync_api import expect, sync_playwright


def test_opens_the_shop():
    playwright = sync_playwright().start()  # expect: QCR-C001
    browser = playwright.chromium.launch()  # expect: QCR-C001
    page = browser.new_page()  # expect: QCR-C001
    page.goto("https://www.saucedemo.com")
    expect(page).to_have_title("Swag Labs")
