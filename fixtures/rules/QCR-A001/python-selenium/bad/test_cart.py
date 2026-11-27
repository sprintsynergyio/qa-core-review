from selenium.webdriver.common.by import By


def test_adds_backpack_to_cart(driver):  # expect: QCR-A001
    driver.get("https://www.saucedemo.com/inventory.html")
    driver.find_element(By.ID, "add-to-cart-sauce-labs-backpack").click()
    badge = driver.find_element(By.CLASS_NAME, "shopping_cart_badge")
    print(badge.text)
