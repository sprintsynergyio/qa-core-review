from selenium.webdriver.common.by import By


def test_adds_the_backpack(driver):
    driver.get("https://www.saucedemo.com/inventory.html")
    driver.find_element(By.CSS_SELECTOR, "[data-test='add-to-cart-sauce-labs-backpack']").click()
    assert driver.find_element(By.CLASS_NAME, "shopping_cart_badge").text == "1"


def test_opens_the_menu(driver):
    driver.get("https://www.saucedemo.com/inventory.html")
    # An XPath that names what it wants does not depend on layout.
    driver.find_element(By.XPATH, "//button[@id='react-burger-menu-btn']").click()
    assert driver.find_element(By.ID, "logout_sidebar_link").is_displayed()
