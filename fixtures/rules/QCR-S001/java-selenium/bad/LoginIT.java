package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;
import java.time.Duration;
import java.util.List;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.*;

class LoginIT {
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
    void logsIn() {
        driver.findElement(By.xpath("//div[2]/div[1]/div/form/input[3]")).click(); // expect: QCR-S001
        assertEquals("Products", driver.findElement(By.xpath("/html/body/div/div/div/div[1]/div[2]/span")).getText()); // expect: QCR-S001
    }
}
