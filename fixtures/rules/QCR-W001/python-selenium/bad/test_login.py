import unittest
from time import sleep

from selenium import webdriver
from selenium.webdriver.common.by import By

PAGE_LOAD = 2


class LoginTests(unittest.TestCase):
    def setUp(self):
        self.driver = webdriver.Chrome()
        self.addCleanup(self.driver.quit)
        self.driver.get("https://www.saucedemo.com")
        sleep(PAGE_LOAD)  # expect: QCR-W001

    def test_logs_in(self):
        self.driver.find_element(By.ID, "user-name").send_keys("standard_user")
        self.driver.find_element(By.ID, "password").send_keys("secret_sauce")
        self.driver.find_element(By.ID, "login-button").click()
        sleep(1.5)  # expect: QCR-W001
        self.assertIn("inventory", self.driver.current_url)
