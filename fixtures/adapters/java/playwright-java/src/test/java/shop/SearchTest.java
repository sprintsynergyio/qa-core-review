package shop;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SearchTest {
    static Playwright playwright;
    static Browser browser;
    Page page;

    @BeforeAll
    static void launch() {
        playwright = Playwright.create();
        browser = playwright.chromium().launch();
    }

    @AfterAll
    static void close() {
        playwright.close();
    }

    @BeforeEach
    void openPage() {
        page = browser.newPage();
        page.navigate("https://www.saucedemo.com/inventory.html");
    }

    @AfterEach
    void closePage() {
        page.close();
    }

    @Test
    void showsTheProducts() {
        assertThat(page.getByText("Products")).isVisible();
    }
}
