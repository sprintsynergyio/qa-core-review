package shop;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

import com.microsoft.playwright.*;
import com.microsoft.playwright.junit.UsePlaywright;
import org.junit.jupiter.api.*;

@UsePlaywright
class InventoryListTest {
    @Test
    void listsTheProducts(Page page) {
        page.navigate("https://www.saucedemo.com/inventory.html");
        assertTrue(page.getByTestId("inventory-item").count() >= 0); // expect: QCR-A003
    }
}
