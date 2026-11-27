package shop;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

import com.microsoft.playwright.*;
import com.microsoft.playwright.junit.UsePlaywright;
import org.junit.jupiter.api.*;

@UsePlaywright
class InventoryTitleTest {
    @Test
    void showsTheTitle(Page page) {
        page.navigate("https://www.saucedemo.com/inventory.html");
        assertThat(page.locator(".title")); // expect: QCR-A003
    }
}
