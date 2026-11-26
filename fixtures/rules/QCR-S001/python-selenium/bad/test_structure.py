from selenium.webdriver.common.by import By


def test_adds_the_second_item(driver):
    driver.get("https://www.saucedemo.com/inventory.html")
    driver.find_element(By.CSS_SELECTOR, ".inventory_list > div:nth-child(2) button").click()  # expect: QCR-S001
    assert driver.find_element(By.CLASS_NAME, "shopping_cart_badge").text == "1"


def test_checkout_button(driver):
    driver.get("https://www.saucedemo.com/cart.html")
    driver.find_element(By.CSS_SELECTOR, "#root > div > main > section > button").click()  # expect: QCR-S001
    assert "checkout-step-one" in driver.current_url


def test_banner_is_shown(driver):
    driver.get("https://www.saucedemo.com")
    assert driver.find_element(By.CSS_SELECTOR, ".css-1q2w3e4").is_displayed()  # expect: QCR-S001
