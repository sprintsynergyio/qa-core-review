package shop;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

import com.microsoft.playwright.*;
import com.microsoft.playwright.junit.UsePlaywright;
import org.junit.jupiter.api.*;

@UsePlaywright
class LoginTest {
    private static final int PAUSE = 2000;

    @BeforeEach
    void open(Page page) {
        page.navigate("https://www.saucedemo.com");
        page.waitForTimeout(PAUSE); // expect: QCR-W001
    }

    @Test
    void showsTheLoginButton(Page page) {
        assertThat(page.getByTestId("login-button")).isVisible();
    }
}
