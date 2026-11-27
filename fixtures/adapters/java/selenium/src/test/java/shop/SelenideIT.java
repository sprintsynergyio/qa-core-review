package shop;

import static com.codeborne.selenide.Condition.text;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.$$;
import static com.codeborne.selenide.Selenide.$$x;
import static com.codeborne.selenide.Selenide.$x;
import static com.codeborne.selenide.Selenide.open;
import static com.codeborne.selenide.Selenide.sleep;

import com.codeborne.selenide.Selenide;
import org.junit.jupiter.api.Test;

class SelenideIT {
    @Test
    void logsIn() {
        open("https://www.saucedemo.com");
        $("#user-name").setValue("standard_user");
        $("#password").setValue("secret_sauce");
        $x("//form/input[3]").click();
        $(".title").shouldHave(text("Products"));
        $(".error-message-container").shouldNotBe(visible);
    }

    @Test
    void sleepsBeforeItCounts() {
        open("https://www.saucedemo.com/inventory.html");
        Selenide.sleep(3000);
        sleep(500);
        $$(".inventory_item").first().shouldHave(text("Backpack"));
        $$x("//div[@class='inventory_item']").get(2).shouldHave(text("Bolt"));
    }
}
