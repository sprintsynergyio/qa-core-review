import unittest

from selenium import webdriver
from selenium.webdriver.common.by import By


class LoginTests(unittest.TestCase):
    def setUp(self):
        self.driver = webdriver.Firefox()  # expect: QCR-C001
        self.driver.get("https://www.saucedemo.com")

    def test_login_button_is_shown(self):
        self.assertTrue(self.driver.find_element(By.ID, "login-button").is_displayed())
