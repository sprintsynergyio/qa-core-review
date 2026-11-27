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
    void addsTheThirdProduct() {
        driver.findElements(By.className("inventory_item")).get(2).click(); // expect: QCR-S001
        driver.findElement(By.cssSelector("ul.inventory_list > li:nth-child(3) button")).click(); // expect: QCR-S001
        assertEquals("1", driver.findElement(By.className("shopping_cart_badge")).getText());
    }
}
