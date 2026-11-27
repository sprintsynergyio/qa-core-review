package shop;

import static org.testng.Assert.assertEquals;

import org.testng.annotations.BeforeMethod;
import org.testng.annotations.DataProvider;
import org.testng.annotations.Test;

// `@Test` on the class makes every public method a test.
@Test
public class CheckoutTest {
    private Checkout checkout;

    @BeforeMethod
    public void newCheckout() {
        checkout = new Checkout(new Cart().add("backpack"));
    }

    public void addsTheTax() {
        assertEquals(checkout.total(), 32.39);
    }

    public void givesAnOrderNumber() {
        assertEquals(checkout.place().number().length(), 8);
    }

    @Test(enabled = false, description = "the invoice is rebuilt")
    public void printsAnInvoice() {
        assertEquals(checkout.invoice().pages(), 1);
    }

    @DataProvider
    public Object[][] cards() {
        return new Object[][] {{"4111"}, {"5500"}};
    }

    // Not public, so not a test.
    void fillAddress() {
        checkout.address("1 Main Street");
    }

    public static Checkout empty() {
        return new Checkout(new Cart());
    }
}
