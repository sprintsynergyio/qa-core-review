package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;
import java.time.Duration;
import java.util.List;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.*;

class InventoryIT {
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
    void addsTheBoltShirt() {
        driver.findElement(By.cssSelector("[data-test='add-to-cart-sauce-labs-bolt-t-shirt']")).click();
        driver.findElement(By.name("add-to-cart-sauce-labs-backpack")).click();
        assertEquals("2", driver.findElement(By.className("shopping_cart_badge")).getText());
    }
}
