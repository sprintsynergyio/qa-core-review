package shop;

import static org.testng.Assert.*;

import org.testng.annotations.*;

@Test
public class CheckoutTest {
    private final Checkout checkout = new Checkout();

    public void paysTheOrder() {
        Receipt receipt = checkout.pay("4111", 29.99);
        assertEquals(receipt.status(), "paid");
    }
}
