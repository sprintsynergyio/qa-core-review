package shop;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.common.util.concurrent.Uninterruptibles;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.FluentWait;
import org.openqa.selenium.support.ui.Wait;
import org.openqa.selenium.support.ui.WebDriverWait;

class CheckoutIT extends BaseUiTest {
    @Test
    void sleepsBetweenTheSteps() throws InterruptedException {
        driver.findElement(By.id("add-to-cart-sauce-labs-backpack")).click();
        Thread.sleep(2000);
        driver.findElement(By.className("shopping_cart_link")).click();
        TimeUnit.SECONDS.sleep(1);
        Thread.sleep(Duration.ofMillis(250));
        Uninterruptibles.sleepUninterruptibly(3, TimeUnit.SECONDS);
        assertEquals("Your Cart", driver.findElement(By.className("title")).getText());
    }

    @Test
    void sleepsInEveryUnitOfTime() throws InterruptedException {
        TimeUnit.NANOSECONDS.sleep(500);
        TimeUnit.MICROSECONDS.sleep(500);
        TimeUnit.MILLISECONDS.sleep(500);
        TimeUnit.MINUTES.sleep(1);
        TimeUnit.HOURS.sleep(1);
        Thread.sleep(Duration.ofNanos(500));
        Thread.sleep(Duration.ofMinutes(1));
        Thread.sleep(Duration.ofHours(1));
        Thread.sleep(pause());
        assertTrue(driver.getTitle().contains("Swag"));
    }

    @Test
    void waitsForACondition() {
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(5));
        WebElement title = wait.until(ExpectedConditions.visibilityOfElementLocated(By.className("title")));
        Wait<WebDriver> patient = new FluentWait<>(driver).withTimeout(Duration.ofSeconds(10));
        patient.until(d -> d.findElement(By.id("checkout")).isEnabled());
        new WebDriverWait(driver, Duration.ofSeconds(2)).until(ExpectedConditions.titleContains("Swag"));
        assertEquals("Products", title.getText());
    }

    @Test
    void setsALongImplicitWait() {
        driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(30));
        driver.manage().timeouts().implicitlyWait(3, TimeUnit.SECONDS);
        assertTrue(driver.findElement(By.id("checkout")).isDisplayed());
    }

    @Test
    void findsElementsInManyWays() {
        driver.navigate().to("https://www.saucedemo.com/inventory.html");
        driver.findElement(By.xpath("//div[@id='inventory_container']/div/div[2]/div[2]/a")).click();
        driver.findElement(By.cssSelector("[data-test='shopping-cart-link']")).click();
        driver.findElement(By.cssSelector("[data-testid='checkout'], [data-qa='checkout'], [data-cy='checkout']")).click();
        driver.findElement(By.name("firstName")).sendKeys("Ada");
        driver.findElement(By.name("firstName")).clear();
        driver.findElement(By.linkText("About")).click();
        driver.findElement(By.partialLinkText("Terms")).click();
        driver.findElements(By.tagName("button")).get(3).click();
        driver.findElements(By.cssSelector(".inventory_item")).get(0).click();
        driver.findElement(By.cssSelector("form.checkout_info")).submit();
        assertEquals("Checkout: Overview", driver.findElement(By.className("title")).getText());
    }

    private long pause() {
        return 100;
    }
}
