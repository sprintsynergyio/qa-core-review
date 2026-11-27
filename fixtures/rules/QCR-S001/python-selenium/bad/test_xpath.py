from selenium.webdriver.common.by import By


def test_adds_the_third_item(driver):
    driver.get("https://www.saucedemo.com/inventory.html")
    driver.find_element(By.XPATH, "/html/body/div[1]/div/div[2]/button[3]").click()  # expect: QCR-S001
    assert driver.find_element(By.CLASS_NAME, "shopping_cart_badge").text == "1"


def test_opens_the_menu(driver):
    driver.get("https://www.saucedemo.com/inventory.html")
    driver.find_element(By.XPATH, "//div[3]/div[2]/button[2]").click()  # expect: QCR-S001
    assert driver.find_element(By.ID, "logout_sidebar_link").is_displayed()
