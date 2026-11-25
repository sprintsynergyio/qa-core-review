"""Menu tests that use only the `page` fixture of pytest-playwright, with no import at all."""


def test_menu_opens(page):
    page.goto("https://www.saucedemo.com/inventory.html")
    page.get_by_role("button", name="Open Menu").click()
    assert page.get_by_role("link", name="Logout").is_visible()


def test_about_link_points_to_the_company(page):
    page.goto("https://www.saucedemo.com/inventory.html")
    page.get_by_role("button", name="Open Menu").click()
    assert page.get_by_role("link", name="About").get_attribute("href").startswith("https://")
