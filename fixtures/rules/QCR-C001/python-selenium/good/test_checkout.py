from selenium import webdriver


def test_checkout():
    driver = webdriver.Chrome()
    try:
        driver.get("https://www.saucedemo.com")
        assert "Swag Labs" in driver.title
    finally:
        driver.quit()


def test_checkout_in_edge():
    with webdriver.Edge() as driver:
        driver.get("https://www.saucedemo.com")
        assert driver.title == "Swag Labs"
