package shop;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

import com.microsoft.playwright.*;
import com.microsoft.playwright.junit.UsePlaywright;
import org.junit.jupiter.api.*;

@UsePlaywright
class InventoryTest {
    @Test
    void showsNoProducts(Page page) {
        page.route("**/*", route -> route.fulfill(new Route.FulfillOptions().setBody("{}"))); // expect: QCR-M001
        page.navigate("https://www.saucedemo.com/inventory.html");
        assertThat(page.locator(".inventory_item")).hasCount(0);
    }
}
