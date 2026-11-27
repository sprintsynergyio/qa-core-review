package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;
import java.time.Duration;
import java.util.List;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.*;

class SlowPageIT {
    private WebDriver driver;

    @BeforeEach
    void start() {
        driver = new ChromeDriver();
        driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(2));
        driver.get("https://www.saucedemo.com");
    }

    @AfterEach
    void stop() {
        driver.quit();
    }

    @Test
    void showsTheLoginButton() {
        assertTrue(driver.findElement(By.id("login-button")).isDisplayed());
    }
}
