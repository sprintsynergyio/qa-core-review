package shop;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

import com.microsoft.playwright.*;
import com.microsoft.playwright.junit.UsePlaywright;
import org.junit.jupiter.api.*;

@UsePlaywright
class LoginTest {
    @Test
    void logsIn(Page page) {
        page.navigate("https://www.saucedemo.com");
        page.getByTestId("login-button").click();
        assertThat(page.getByTestId("title")).hasText("Products");
    }
}
