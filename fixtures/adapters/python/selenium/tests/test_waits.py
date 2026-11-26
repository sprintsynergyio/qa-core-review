"""Selenium: every By strategy, condition waits, drivers and how they are closed."""
import unittest

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

BASE = "https://www.saucedemo.com"
LOGIN_BUTTON = (By.ID, "login-button")


class StrategyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.driver = webdriver.Firefox()
        cls.addClassCleanup(cls.driver.quit)

    def setUp(self):
        self.driver.get(BASE)

    def test_every_strategy(self):
        driver = self.driver
        driver.find_element(By.NAME, "user-name").send_keys("standard_user")
        driver.find_element(By.CSS_SELECTOR, "[data-test='password']").send_keys("secret_sauce")
        driver.find_element(By.CSS_SELECTOR, "[data-testid='password']").clear()
        driver.find_element(*LOGIN_BUTTON).submit()
        self.assertTrue(driver.find_element(By.LINK_TEXT, "Twitter").is_displayed())
        self.assertTrue(driver.find_element(By.PARTIAL_LINK_TEXT, "Face").is_displayed())
        self.assertEqual(len(driver.find_elements(By.TAG_NAME, "footer")), 1)
        self.assertEqual(driver.find_elements(By.CLASS_NAME, "inventory_item_name")[0].text, "Sauce Labs Backpack")
        self.assertEqual(driver.find_elements(By.XPATH, "//div[@class='inventory_item_price']")[2].text, "$15.99")
        self.assertTrue(driver.find_elements_by_css_selector(".inventory_item"))

    def test_condition_waits(self):
        wait = WebDriverWait(self.driver, 10)
        wait.until(EC.element_to_be_clickable(LOGIN_BUTTON))
        WebDriverWait(self.driver, 5).until(EC.presence_of_element_located((By.ID, "user-name")))
        WebDriverWait(self.driver, 5).until_not(EC.visibility_of_element_located((By.CLASS_NAME, "error")))
        self.assertIn("Swag", self.driver.title)


class DriverTests(unittest.TestCase):
    def test_driver_that_is_never_closed(self):
        driver = webdriver.Edge()
        driver.get(BASE)
        self.assertIn("Swag", driver.title)

    def test_driver_closed_in_finally(self):
        driver = webdriver.Safari()
        try:
            driver.get(BASE)
            self.assertIn("Swag", driver.title)
        finally:
            driver.quit()

    def test_remote_driver_with_cleanup(self):
        driver = webdriver.Remote(command_executor="http://grid.example.test:4444")
        self.addCleanup(driver.quit)
        driver.get(BASE)
        self.assertIn("Swag", driver.title)
