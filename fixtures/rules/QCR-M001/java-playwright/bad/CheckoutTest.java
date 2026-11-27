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
        page.route("**/*", route -> { // expect: QCR-M001
            route.fulfill(new Route.FulfillOptions().setContentType("application/json").setBody("{\"total\": 32.39}"));
        });
        page.navigate("https://www.saucedemo.com/checkout-step-two.html");
        assertThat(page.getByTestId("total-label")).hasText("Total: $32.39");
    }
}
