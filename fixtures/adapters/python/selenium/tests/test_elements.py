"""What a Selenium element is in an assertion: it always exists, a list of elements may be empty."""
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement


def test_element_checks(driver: webdriver.Chrome):
    driver.get("https://www.saucedemo.com/inventory.html")
    badge: WebElement = driver.find_element(By.CLASS_NAME, "shopping_cart_link")
    assert badge
    assert driver.find_element(By.ID, "inventory_container") is not None
    assert driver.find_element_by_id("inventory_container")
    assert driver.find_elements(By.CLASS_NAME, "inventory_item")
    assert len(driver.find_elements(By.CLASS_NAME, "inventory_item")) == 6
    assert badge.is_displayed()
    assert "Swag Labs" in driver.title
