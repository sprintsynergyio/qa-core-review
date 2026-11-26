import unittest

from selenium import webdriver
from selenium.webdriver.common.by import By


class LoginTests(unittest.TestCase):
    def setUp(self):
        self.driver = webdriver.Firefox()
        self.driver.get("https://www.saucedemo.com")

    def tearDown(self):
        self.driver.quit()

    def test_login_button_is_shown(self):
        self.assertTrue(self.driver.find_element(By.ID, "login-button").is_displayed())
