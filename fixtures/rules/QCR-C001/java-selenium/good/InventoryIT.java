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
        driver.get("https://www.saucedemo.com/inventory.html");
    }

    @AfterEach
    void stop() {
        driver.quit();
    }

    @Test
    void showsSixProducts() {
        assertEquals(6, driver.findElements(By.className("inventory_item")).size());
    }
}
