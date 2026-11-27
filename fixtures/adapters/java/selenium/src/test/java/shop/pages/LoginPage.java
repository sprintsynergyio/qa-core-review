package shop.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

// A page object: a support file with no test and no hook.
public class LoginPage {
    private final WebDriver driver;

    public LoginPage(WebDriver driver) {
        this.driver = driver;
    }

    public void loginAs(String user, String password) {
        driver.findElement(By.id("user-name")).sendKeys(user);
        driver.findElement(By.id("password")).sendKeys(password);
        driver.findElement(By.id("login-button")).click();
    }
}
