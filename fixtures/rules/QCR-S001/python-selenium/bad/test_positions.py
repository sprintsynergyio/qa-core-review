from selenium.webdriver.common.by import By


def test_third_item_is_the_bolt_shirt(driver):
    driver.get("https://www.saucedemo.com/inventory.html")
    item = driver.find_elements(By.CLASS_NAME, "inventory_item_name")[2]  # expect: QCR-S001
    assert item.text == "Sauce Labs Bolt T-Shirt"


def test_login_with_the_old_api(driver):
    driver.get("https://www.saucedemo.com")
    driver.find_element_by_xpath("/html/body/div/form/input[3]").click()  # expect: QCR-S001
    assert driver.find_element_by_id("error").is_displayed()
