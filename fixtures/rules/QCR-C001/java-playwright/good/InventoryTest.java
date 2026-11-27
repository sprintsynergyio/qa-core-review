package shop;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

import com.microsoft.playwright.*;
import com.microsoft.playwright.junit.UsePlaywright;
import org.junit.jupiter.api.*;

class InventoryTest {
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
    void open() {
        page = browser.newPage();
        page.navigate("https://www.saucedemo.com/inventory.html");
    }

    @AfterEach
    void closeThePage() {
        page.close();
    }

    @Test
    void showsSixProducts() {
        assertThat(page.getByTestId("inventory-item")).hasCount(6);
    }
}
