package shop;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

import com.microsoft.playwright.*;
import com.microsoft.playwright.junit.UsePlaywright;
import org.junit.jupiter.api.*;

@UsePlaywright
class CartTest {
    @Test
    void keepsTheCartPerUser(Browser browser) {
        BrowserContext other = browser.newContext(); // expect: QCR-C001
        Page page = other.newPage(); // expect: QCR-C001
        page.navigate("https://www.saucedemo.com/cart.html");
        assertThat(page.getByTestId("inventory-item")).hasCount(0);
    }
}
