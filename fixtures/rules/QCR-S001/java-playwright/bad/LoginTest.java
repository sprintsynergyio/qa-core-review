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
        page.locator("//div[2]/div[1]/div/form/input[3]").click(); // expect: QCR-S001
        assertThat(page.locator("xpath=//div[@id='header_container']/div[2]/span")).hasText("Products"); // expect: QCR-S001
    }
}
