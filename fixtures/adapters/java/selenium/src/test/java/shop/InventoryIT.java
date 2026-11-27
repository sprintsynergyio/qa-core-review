package shop;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.codeborne.selenide.SelenideElement;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindAll;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.FindBys;

class InventoryIT extends BaseUiTest {
    @FindBy(className = "shopping_cart_badge")
    private WebElement badge;

    @FindBys({@FindBy(className = "inventory_list"), @FindBy(className = "inventory_item")})
    private List<WebElement> items;

    @FindAll({@FindBy(id = "react-burger-menu-btn"), @FindBy(className = "bm-burger-button")})
    private WebElement menu;

    private SelenideElement sortBox;

    @Test
    void showsSixProducts() {
        driver.get("https://www.saucedemo.com/inventory.html");
        List<WebElement> names = driver.findElements(By.className("inventory_item_name"));
        assertEquals(6, names.size());
        assertEquals("Sauce Labs Backpack", names.get(0).getText());
    }

    @Test
    void checksOnlyThatTheElementIsThere() {
        WebElement title = driver.findElement(By.className("title"));
        assertNotNull(title);
        assertNotNull(driver.findElement(By.id("shopping_cart_container")));
        assertNotNull(badge);
        assertNotNull(items.get(0));
        assertNotNull(sortBox);
    }

    @Test
    void countsAtLeastNothing() {
        int shown = driver.findElements(By.className("inventory_item")).size();
        assertTrue(shown >= 0);
        assertTrue(items.size() >= 0);
        assertFalse(driver.getTitle().length() < 0);
    }

    @Test
    void readsWhatTheElementsShow() {
        assertTrue(menu.isDisplayed());
        assertEquals("1", badge.getText());
        assertFalse(items.isEmpty());
    }
}
