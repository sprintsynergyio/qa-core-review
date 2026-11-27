from selenium.webdriver.common.by import By


def test_bolt_shirt_is_listed(driver):
    driver.get("https://www.saucedemo.com/inventory.html")
    names = [item.text for item in driver.find_elements(By.CLASS_NAME, "inventory_item_name")]
    assert "Sauce Labs Bolt T-Shirt" in names


def test_first_item_has_a_price(driver):
    driver.get("https://www.saucedemo.com/inventory.html")
    # Index 0 is what find_element gives.
    price = driver.find_elements(By.CLASS_NAME, "inventory_item_price")[0]
    assert price.text.startswith("$")
