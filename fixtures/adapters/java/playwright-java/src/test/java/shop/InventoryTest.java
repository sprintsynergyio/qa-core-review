package shop;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microsoft.playwright.ElementHandle;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.junit.UsePlaywright;
import com.microsoft.playwright.options.AriaRole;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@UsePlaywright
class InventoryTest {
    @BeforeEach
    void openTheShop(Page page) {
        page.navigate("https://www.saucedemo.com/inventory.html");
        assertThat(page).hasTitle("Swag Labs");
    }

    @Test
    void showsSixProducts(Page page) {
        Locator items = page.locator(".inventory_item");
        assertThat(items).hasCount(6);
        assertThat(items.first()).containsText("Backpack");
        assertThat(items.last()).hasText(Pattern.compile("T-Shirt"));
        assertThat(items.nth(1)).isVisible();
        assertThat(items.filter(new Locator.FilterOptions().setHasText("Onesie"))).hasCount(1);
    }

    @Test
    void readsTheStateOfTheControls(Page page) {
        assertThat(page).hasURL("https://www.saucedemo.com/inventory.html");
        assertThat(page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Open Menu"))).isEnabled();
        assertThat(page.getByText("Products")).isVisible();
        assertThat(page.getByLabel("Sort")).isEditable();
        assertThat(page.getByPlaceholder("Search")).isHidden();
        assertThat(page.getByTestId("shopping-cart-badge")).not().isVisible();
        assertThat(page.getByAltText("Sauce Labs Backpack")).isAttached();
        assertThat(page.getByTitle("Menu")).isInViewport();
        assertThat(page.frameLocator("#help").locator("button")).isDisabled();
        assertThat(page.locator("#remember")).isChecked();
        assertThat(page.locator("#search")).isFocused();
    }

    @Test
    void readsTheAttributesOfAnElement(Page page) {
        Locator sort = page.locator("[data-test='product-sort-container']");
        assertThat(sort).hasValue("az");
        assertThat(sort).hasAttribute("data-test", "product-sort-container");
        assertThat(sort).hasClass("product_sort_container");
        assertThat(sort).hasCSS("display", "block");
        assertThat(sort).hasId("sort");
    }

    @Test
    void checksOnlyThatTheLocatorIsThere(Page page) {
        Locator badge = page.locator(".shopping_cart_badge");
        assertNotNull(badge);
        assertNotNull(page.getByText("Checkout"));
        assertTrue(badge.count() >= 0);
    }

    @Test
    void checksThatAHandleWasFound(Page page) {
        ElementHandle title = page.querySelector(".title");
        assertNotNull(title);
    }

    @Test
    void forgetsTheMatcher(Page page) {
        assertThat(page.locator(".title"));
    }
}
