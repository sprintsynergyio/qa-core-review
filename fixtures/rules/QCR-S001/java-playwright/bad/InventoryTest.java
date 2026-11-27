package shop;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

import com.microsoft.playwright.*;
import com.microsoft.playwright.junit.UsePlaywright;
import org.junit.jupiter.api.*;

@UsePlaywright
class InventoryTest {
    @Test
    void addsTheThirdProduct(Page page) {
        page.navigate("https://www.saucedemo.com/inventory.html");
        page.locator("ul.inventory_list > li:nth-child(3) button").click(); // expect: QCR-S001
        page.locator(".inventory_item button").nth(4).click(); // expect: QCR-S001
        assertThat(page.getByTestId("shopping-cart-badge")).hasText("2");
    }
}
