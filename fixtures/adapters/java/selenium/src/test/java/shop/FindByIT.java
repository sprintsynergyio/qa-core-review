package shop;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.How;
import org.openqa.selenium.support.PageFactory;

class FindByIT extends BaseUiTest {
    @FindBy(xpath = "//div[@class='inventory_list']/div[3]//button")
    private WebElement thirdAddButton;

    @FindBy(css = "[data-test='title']")
    private WebElement title;

    @FindBy(name = "user-name")
    private WebElement userName;

    @FindBy(linkText = "Twitter")
    private WebElement twitter;

    @FindBy(partialLinkText = "Face")
    private WebElement facebook;

    @FindBy(tagName = "footer")
    private WebElement footer;

    @FindBy(how = How.XPATH, using = "//footer/ul/li[1]/a")
    private WebElement firstSocialLink;

    @FindBy(how = How.CSS, using = ".footer_copy")
    private WebElement copyright;

    @FindBy(how = How.CLASS_NAME, using = "inventory_item")
    private List<WebElement> items;

    @FindBy(how = How.ID, using = "logout_sidebar_link")
    private WebElement logout;

    @FindBy(how = How.NAME, using = "password")
    private WebElement password;

    @FindBy(how = How.LINK_TEXT, using = "LinkedIn")
    private WebElement linkedIn;

    @FindBy(how = How.PARTIAL_LINK_TEXT, using = "Linked")
    private WebElement anyLinkedIn;

    @FindBy(how = How.TAG_NAME, using = "select")
    private WebElement sortBox;

    @BeforeEach
    void bindTheFields() {
        PageFactory.initElements(driver, this);
    }

    @Test
    void addsTheThirdProduct() {
        thirdAddButton.click();
        assertEquals("Products", title.getText());
    }

    @Test
    void showsTheFooter() {
        assertTrue(footer.isDisplayed());
        assertTrue(copyright.getText().contains("Sauce Labs"));
        assertEquals("Twitter", twitter.getText());
        assertEquals("Twitter", firstSocialLink.getText());
        assertEquals(6, items.size());
    }

    @Test
    void readsTheTitleAgain() {
        assertEquals("Products", title.getText());
    }
}
