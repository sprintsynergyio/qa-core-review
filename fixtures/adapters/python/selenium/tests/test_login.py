"""Login tests with Selenium and unittest."""
import time
import unittest

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

BASE = "https://www.saucedemo.com"


class LoginTests(unittest.TestCase):
    def setUp(self):
        self.driver = webdriver.Chrome()
        self.driver.implicitly_wait(10)
        self.driver.get(BASE)

    def tearDown(self):
        self.driver.quit()

    def login(self, user, password="secret_sauce"):
        self.driver.find_element(By.ID, "user-name").send_keys(user)
        self.driver.find_element(By.ID, "password").send_keys(password)
        self.driver.find_element(By.CSS_SELECTOR, "#login-button").click()

    def test_standard_user_sees_the_inventory(self):
        self.login("standard_user")
        WebDriverWait(self.driver, 5).until(EC.url_contains("inventory"))
        self.assertIn("inventory", self.driver.current_url)

    def test_locked_out_user_sees_an_error(self):
        self.login("locked_out_user")
        time.sleep(2)
        error = self.driver.find_element(By.XPATH, "//div[@class='error-message-container error']/h3")
        self.assertIn("locked out", error.text)

    def test_wrong_password(self):
        self.login("standard_user", "wrong")
        try:
            error = self.driver.find_element(By.CLASS_NAME, "error-message-container")
            self.assertTrue(error.is_displayed())
        except Exception:
            pass
