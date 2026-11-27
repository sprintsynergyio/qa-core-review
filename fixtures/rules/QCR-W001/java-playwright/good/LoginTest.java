package shop;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

import com.microsoft.playwright.*;
import com.microsoft.playwright.junit.UsePlaywright;
import org.junit.jupiter.api.*;

@UsePlaywright
class LoginTest {
    @BeforeEach
    void open(Page page) {
        page.navigate("https://www.saucedemo.com");
        page.waitForLoadState();
    }

    @Test
    void showsTheLoginButton(Page page) {
        assertThat(page.getByTestId("login-button")).isVisible();
    }
}
