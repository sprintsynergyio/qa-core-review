package shop;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

import com.microsoft.playwright.*;
import com.microsoft.playwright.junit.UsePlaywright;
import org.junit.jupiter.api.*;

@UsePlaywright
class CheckoutTest {
    @Test
    void showsTheTotal(Page page) {
        page.route("**/*", route -> route.resume());
        page.navigate("https://www.saucedemo.com/checkout-step-two.html");
        assertThat(page.getByTestId("total-label")).hasText("Total: $32.39");
    }
}
