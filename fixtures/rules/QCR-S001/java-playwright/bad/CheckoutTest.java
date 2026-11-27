package shop;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

import com.microsoft.playwright.*;
import com.microsoft.playwright.junit.UsePlaywright;
import org.junit.jupiter.api.*;

@UsePlaywright
class CheckoutTest {
    @Test
    void opensTheCheckout(Page page) {
        page.navigate("https://www.saucedemo.com/cart.html");
        page.locator(".sc-bdfBwQ").click(); // expect: QCR-S001
        page.locator("#root > div > div > main > section > button").click(); // expect: QCR-S001
        assertThat(page).hasURL("https://www.saucedemo.com/checkout-step-one.html");
    }
}
