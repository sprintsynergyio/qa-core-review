from selenium.webdriver.common.by import By


def test_adds_the_bike_light(driver):
    driver.get("https://www.saucedemo.com/inventory.html")
    driver.find_element(By.ID, "add-to-cart-sauce-labs-bike-light").click()
    assert driver.find_element(By.CLASS_NAME, "shopping_cart_badge").text == "1"


def test_checkout_button(driver):
    driver.get("https://www.saucedemo.com/cart.html")
    driver.find_element(By.CSS_SELECTOR, ".cart_footer > #checkout").click()
    assert "checkout-step-one" in driver.current_url
