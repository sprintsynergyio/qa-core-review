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
        page.getByTestId("checkout").click();
        assertThat(page).hasURL("https://www.saucedemo.com/checkout-step-one.html");
    }
}
