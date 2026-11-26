import unittest

from selenium import webdriver
from selenium.webdriver.common.by import By


class CheckoutTests(unittest.TestCase):
    def setUp(self):
        self.driver = webdriver.Chrome()
        self.addCleanup(self.driver.quit)

    def test_opens_checkout(self):
        self.driver.get("https://www.saucedemo.com/cart.html")
        self.driver.find_element(By.ID, "checkout").click()
        self.assertIn("checkout-step-one", self.driver.current_url)
