package shop;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

import com.microsoft.playwright.*;
import com.microsoft.playwright.junit.UsePlaywright;
import org.junit.jupiter.api.*;

@UsePlaywright
class CheckoutButtonTest {
    @Test
    void showsTheCheckoutButton(Page page) {
        page.navigate("https://www.saucedemo.com/cart.html");
        Locator checkout = page.getByTestId("checkout");
        assertThat(checkout).isVisible();
    }
}
