import pytest
from selenium import webdriver


@pytest.fixture
def driver():
    driver = webdriver.Chrome()
    driver.implicitly_wait(30)  # expect: QCR-W001
    yield driver
    driver.quit()


def test_title(driver):
    driver.get("https://www.saucedemo.com")
    assert driver.title == "Swag Labs"
