package shop;

import static org.testng.Assert.assertEquals;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.testng.annotations.AfterClass;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

public class DriverLifecycleTest {
    private WebDriver driver;
    private static WebDriver sharedDriver;

    @BeforeClass
    public static void startTheSharedDriver() {
        sharedDriver = new ChromeDriver();
    }

    @AfterClass
    public static void forgetTheSharedDriver() {
        sharedDriver = null;
    }

    @BeforeMethod
    public void startTheDriver() {
        driver = new ChromeDriver();
        driver.get("https://www.saucedemo.com");
    }

    @AfterMethod
    public void quitTheDriver() {
        driver.quit();
    }

    @Test
    public void showsTheLoginPage() {
        assertEquals(driver.findElement(By.id("login-button")).getAttribute("value"), "Login");
    }
}
