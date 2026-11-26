import pytest
from selenium import webdriver


@pytest.fixture
def driver():
    driver = webdriver.Chrome()
    # A short implicit wait is not reported.
    driver.implicitly_wait(2)
    yield driver
    driver.quit()


def test_title(driver):
    driver.get("https://www.saucedemo.com")
    assert driver.title == "Swag Labs"
    assert driver.current_url == "https://www.saucedemo.com/"
