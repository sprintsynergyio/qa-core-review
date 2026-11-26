import pytest
from selenium import webdriver


@pytest.fixture
def driver():
    driver = webdriver.Chrome()
    driver.get("https://www.saucedemo.com/inventory.html")
    yield driver
    driver.quit()


def test_inventory_title(driver):
    assert driver.title == "Swag Labs"
    assert "inventory" in driver.current_url
