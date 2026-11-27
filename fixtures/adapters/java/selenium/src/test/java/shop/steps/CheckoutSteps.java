package shop.steps;

import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

// Step definitions are not tests of their own. They are linked to their scenarios in a later version.
public class CheckoutSteps {
    private final WebDriver driver;

    public CheckoutSteps(WebDriver driver) {
        this.driver = driver;
    }

    @Given("a cart with one backpack")
    public void aCartWithOneBackpack() {
        driver.findElement(By.id("add-to-cart-sauce-labs-backpack")).click();
    }

    @When("the user checks out")
    public void theUserChecksOut() {
        driver.findElement(By.id("checkout")).click();
    }

    @Then("the total is {string}")
    public void theTotalIs(String total) {
        if (!driver.findElement(By.className("summary_total_label")).getText().endsWith(total)) {
            throw new AssertionError("wrong total");
        }
    }
}
