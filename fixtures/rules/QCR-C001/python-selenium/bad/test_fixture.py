import pytest
from selenium import webdriver


@pytest.fixture
def driver():
    driver = webdriver.Chrome()  # expect: QCR-C001
    driver.get("https://www.saucedemo.com/inventory.html")
    return driver


def test_inventory_title(driver):
    assert driver.title == "Swag Labs"
