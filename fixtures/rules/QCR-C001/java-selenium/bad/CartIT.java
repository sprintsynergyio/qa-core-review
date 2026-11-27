package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;
import java.time.Duration;
import java.util.List;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.*;

class CartIT {
    private final WebDriver driver = new ChromeDriver(); // expect: QCR-C001

    @Test
    void startsWithAnEmptyCart() {
        driver.get("https://www.saucedemo.com/cart.html");
        assertTrue(driver.findElements(By.className("cart_item")).isEmpty());
    }
}
