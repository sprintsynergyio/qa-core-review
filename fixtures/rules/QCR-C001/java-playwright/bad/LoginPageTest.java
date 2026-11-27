package shop;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

import com.microsoft.playwright.*;
import com.microsoft.playwright.junit.UsePlaywright;
import org.junit.jupiter.api.*;

class LoginPageTest {
    @Test
    void showsTheLoginPage() {
        Playwright playwright = Playwright.create(); // expect: QCR-C001
        Browser browser = playwright.chromium().launch(); // expect: QCR-C001
        Page page = browser.newPage(); // expect: QCR-C001
        page.navigate("https://www.saucedemo.com");
        assertThat(page).hasTitle("Swag Labs");
    }
}
