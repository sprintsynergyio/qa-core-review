package shop;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;

// A base class in a support file: it starts the browser and closes it again.
abstract class BaseUiTest {
    protected WebDriver driver;

    @BeforeEach
    void startBrowser() {
        driver = new ChromeDriver();
        driver.get("https://www.saucedemo.com");
    }

    @AfterEach
    void closeBrowser() {
        driver.quit();
    }
}
