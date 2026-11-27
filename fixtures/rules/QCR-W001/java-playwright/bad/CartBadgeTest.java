package shop;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

import com.microsoft.playwright.*;
import com.microsoft.playwright.junit.UsePlaywright;
import org.junit.jupiter.api.*;

@UsePlaywright
class CartBadgeTest {
    @Test
    void showsTheBadge(Page page) {
        page.navigate("https://www.saucedemo.com/inventory.html");
        page.getByTestId("add-to-cart-sauce-labs-backpack").click();
        page.waitForTimeout(3000); // expect: QCR-W001
        assertThat(page.getByTestId("shopping-cart-badge")).hasText("1");
    }
}
