package shop;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.appium.java_client.AppiumDriver;
import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.ios.IOSDriver;
import io.github.bonigarcia.wdm.WebDriverManager;
import java.net.URL;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.edge.EdgeDriver;
import org.openqa.selenium.firefox.FirefoxDriver;
import org.openqa.selenium.remote.RemoteWebDriver;
import org.openqa.selenium.safari.SafariDriver;

class DriversIT {
    private static final String SHOP = "https://www.saucedemo.com";
    private WebDriver shared;

    @AfterEach
    void quitTheSharedDriver() {
        if (shared != null) {
            shared.quit();
        }
    }

    @Test
    void quitsItsOwnDriver() {
        WebDriver driver = new FirefoxDriver();
        try {
            driver.get(SHOP);
            assertEquals("Swag Labs", driver.getTitle());
        } finally {
            driver.quit();
        }
    }

    @Test
    void leavesTheBrowserOpen() {
        WebDriver driver = new EdgeDriver();
        driver.get(SHOP);
        assertEquals("Swag Labs", driver.getTitle());
    }

    @Test
    void leavesTheDriverToTheHook() throws Exception {
        shared = new RemoteWebDriver(new URL("https://grid.example.test/wd/hub"), new SafariOptions());
        shared.get(SHOP);
        assertEquals("Swag Labs", shared.getTitle());
    }

    @Test
    void closesOnlyTheWindow() {
        WebDriver driver = new SafariDriver();
        driver.get(SHOP);
        assertEquals("Swag Labs", driver.getTitle());
        driver.close();
    }

    @Test
    void startsADriverThroughTheManager() {
        WebDriver driver = WebDriverManager.chromedriver().create();
        driver.get(SHOP);
        assertEquals("Swag Labs", driver.getTitle());
    }

    @Test
    void startsMobileDrivers() throws Exception {
        URL server = new URL("https://grid.example.test/wd/hub");
        AppiumDriver any = new AppiumDriver(server, capabilities());
        AndroidDriver android = new AndroidDriver(server, capabilities());
        IOSDriver ios = new IOSDriver(server, capabilities());
        assertEquals("Swag Labs", android.getTitle());
        any.quit();
        android.quit();
    }
}
