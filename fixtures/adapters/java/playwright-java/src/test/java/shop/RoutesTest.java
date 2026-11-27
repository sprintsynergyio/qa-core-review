package shop;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Frame;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.Route;
import java.nio.file.Paths;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class RoutesTest {
    private Playwright playwright;
    private Browser browser;
    private BrowserContext context;
    private Page page;

    @BeforeEach
    void openThePage() {
        playwright = Playwright.create();
        browser = playwright.chromium().launch();
        context = browser.newContext();
        page = context.newPage();
        page.navigate("https://www.saucedemo.com/inventory.html");
    }

    @AfterEach
    void closeEverything() {
        context.close();
        browser.close();
        playwright.close();
    }

    @Test
    void answersEveryRequestWithAFake() {
        page.route("**/*", route -> route.fulfill(new Route.FulfillOptions().setBody("{\"items\": []}")));
        page.reload();
        assertThat(page.locator(".inventory_item")).hasCount(0);
    }

    @Test
    void answersOneRequestWithAFake() {
        page.route("**/api/orders", route -> route.fulfill(new Route.FulfillOptions().setStatus(500)));
        context.route("**", route -> route.fallback());
        page.route("*", route -> route.resume());
        page.click("#checkout");
        assertThat(page.getByText("Something went wrong")).isVisible();
    }

    @Test
    void sleepsAndWaits() {
        page.click("[data-test='add-to-cart-sauce-labs-backpack']");
        page.waitForTimeout(1500);
        page.waitForSelector(".shopping_cart_badge");
        page.waitForURL("**/inventory.html");
        page.locator(".shopping_cart_badge").waitFor();
        assertThat(page.locator(".shopping_cart_badge")).hasText("1");
    }

    @Test
    void usesThePageWithSelectors() {
        page.dblclick("#item_4_title_link");
        page.goBack();
        page.hover("div.inventory_list > div:nth-child(3) > div > a");
        page.fill("#first-name", "Ada");
        page.press("#first-name", "Tab");
        page.check("#terms");
        page.uncheck("#newsletter");
        page.selectOption("[data-test='product-sort-container']", "za");
        assertEquals("Products", page.textContent(".title"));
        assertEquals("Products", page.innerText(".title"));
        assertEquals(6, page.querySelectorAll(".inventory_item").size());
        assertThat(page.locator(".inventory_item").last()).isVisible();
    }

    @Test
    void looksInsideAFrameAndAPopup() {
        Frame frame = page.frame("help");
        frame.click("#close");
        Page popup = page.waitForPopup(() -> page.click("#terms-link"));
        popup.fill("#email", "ada@example.test");
        popup.close();
        assertThat(page.locator("#terms-link")).isVisible();
    }

    @Test
    void opensMoreThanItCloses() {
        Playwright second = Playwright.create();
        BrowserContext kept = second.firefox().launchPersistentContext(Paths.get("build/profile"));
        Page other = browser.newPage();
        assertThat(other).hasTitle("");
        kept.close();
    }
}
