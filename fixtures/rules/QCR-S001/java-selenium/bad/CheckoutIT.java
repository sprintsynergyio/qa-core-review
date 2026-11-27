package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;
import java.time.Duration;
import java.util.List;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.*;

class CheckoutIT {
    private WebDriver driver;

    @BeforeEach
    void start() {
        driver = new ChromeDriver();
        driver.get("https://www.saucedemo.com");
    }

    @AfterEach
    void stop() {
        driver.quit();
    }

    @Test
    void opensTheCheckout() {
        driver.findElement(By.cssSelector(".css-1x2y3z4")).click(); // expect: QCR-S001
        driver.findElement(By.cssSelector("#root > div > div > main > section > button")).click(); // expect: QCR-S001
        assertTrue(driver.getCurrentUrl().endsWith("/checkout-step-one.html"));
    }
}
