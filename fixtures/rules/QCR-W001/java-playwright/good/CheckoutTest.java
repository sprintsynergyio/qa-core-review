package shop;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

import com.microsoft.playwright.*;
import com.microsoft.playwright.junit.UsePlaywright;
import org.junit.jupiter.api.*;

@UsePlaywright
class CheckoutTest {
    @Test
    void finishesTheOrder(Page page) {
        page.navigate("https://www.saucedemo.com/checkout-step-two.html");
        page.getByTestId("finish").click();
        page.waitForURL("**/checkout-complete.html");
        assertThat(page.getByTestId("complete-header")).hasText("Thank you for your order!");
    }
}
