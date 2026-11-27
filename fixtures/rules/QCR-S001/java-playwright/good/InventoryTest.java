package shop;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

import com.microsoft.playwright.*;
import com.microsoft.playwright.junit.UsePlaywright;
import org.junit.jupiter.api.*;

@UsePlaywright
class InventoryTest {
    @Test
    void addsTheBoltShirt(Page page) {
        page.navigate("https://www.saucedemo.com/inventory.html");
        page.getByTestId("add-to-cart-sauce-labs-bolt-t-shirt").click();
        page.getByRole(com.microsoft.playwright.options.AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Add to cart")).first().click();
        assertThat(page.getByTestId("shopping-cart-badge")).hasText("2");
    }
}
