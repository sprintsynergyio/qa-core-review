package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;
import java.time.Duration;
import java.util.List;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.*;
import java.util.concurrent.TimeUnit;

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
    void finishesTheOrder() throws InterruptedException {
        driver.findElement(By.id("finish")).click();
        TimeUnit.SECONDS.sleep(2); // expect: QCR-W001
        assertEquals("Thank you for your order!", driver.findElement(By.className("complete-header")).getText());
    }
}
