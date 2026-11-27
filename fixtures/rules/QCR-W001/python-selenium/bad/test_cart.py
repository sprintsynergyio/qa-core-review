import time

from selenium.webdriver.common.by import By


def test_adds_backpack_to_cart(driver):
    driver.get("https://www.saucedemo.com/inventory.html")
    driver.find_element(By.ID, "add-to-cart-sauce-labs-backpack").click()
    time.sleep(3)  # expect: QCR-W001
    assert driver.find_element(By.CLASS_NAME, "shopping_cart_badge").text == "1"
