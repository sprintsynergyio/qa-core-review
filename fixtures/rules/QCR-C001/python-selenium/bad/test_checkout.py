from selenium import webdriver


def test_checkout():
    driver = webdriver.Chrome()  # expect: QCR-C001
    driver.get("https://www.saucedemo.com")
    assert "Swag Labs" in driver.title
