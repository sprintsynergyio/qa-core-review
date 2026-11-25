"""Inventory tests with Selenium and pytest, in a project that does not list pytest."""
import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By

BASE = "https://www.saucedemo.com"


@pytest.fixture(scope="module")
def driver():
    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new")
    browser = webdriver.Chrome(options=options)
    browser.get(f"{BASE}/inventory.html")
    yield browser
    browser.quit()


def test_six_products_are_listed(driver):
    assert len(driver.find_elements(By.CLASS_NAME, "inventory_item")) == 6


def test_first_product_is_the_backpack(driver):
    name = driver.find_element(By.XPATH, "(//div[@class='inventory_item_name'])[1]")
    assert name.text == "Sauce Labs Backpack"


@pytest.mark.parametrize("label", ["Name (A to Z)", "Name (Z to A)", "Price (low to high)", "Price (high to low)"])
def test_sort_option_exists(driver, label):
    options = driver.find_elements(By.CSS_SELECTOR, "select.product_sort_container option")
    assert label in [option.text for option in options]
