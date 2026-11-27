package shop;

import static org.testng.Assert.assertTrue;

import org.testng.annotations.Test;

// The whole class is switched off.
@Test(enabled = false, description = "replaced by CheckoutTest")
public class LegacyCheckoutTest {
    public void paysWithACheque() {
        assertTrue(Shop.pay("cheque").ok());
    }
}
