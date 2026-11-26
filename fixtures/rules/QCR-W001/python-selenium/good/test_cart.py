from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


def test_adds_backpack_to_cart(driver):
    driver.get("https://www.saucedemo.com/inventory.html")
    driver.find_element(By.ID, "add-to-cart-sauce-labs-backpack").click()
    WebDriverWait(driver, 10).until(EC.text_to_be_present_in_element((By.CLASS_NAME, "shopping_cart_badge"), "1"))
    assert driver.find_element(By.CLASS_NAME, "shopping_cart_badge").text == "1"
