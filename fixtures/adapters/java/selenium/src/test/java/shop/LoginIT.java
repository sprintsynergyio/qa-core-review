package shop;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import shop.pages.LoginPage;

@DisplayName("Login")
class LoginIT extends BaseUiTest {
    @Test
    @DisplayName("a standard user reaches the products")
    void standardUserLogsIn() {
        new LoginPage(driver).loginAs("standard_user", "secret_sauce");
        assertEquals("Products", driver.findElement(By.className("title")).getText());
    }

    @Test
    void lockedUserSeesAnError() {
        new LoginPage(driver).loginAs("locked_out_user", "secret_sauce");
        assertTrue(driver.findElement(By.cssSelector("[data-test='error']")).getText().contains("locked out"));
    }
}
