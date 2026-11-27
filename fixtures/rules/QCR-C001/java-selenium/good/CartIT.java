package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;
import java.time.Duration;
import java.util.List;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.*;

class CartIT {
    private final WebDriver driver = new ChromeDriver();

    @AfterEach
    void stop() {
        driver.quit();
    }

    @Test
    void startsWithAnEmptyCart() {
        driver.get("https://www.saucedemo.com/cart.html");
        assertEquals(0, driver.findElements(By.className("cart_item")).size());
    }
}
