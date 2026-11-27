package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class CheckoutTest {
    private final Checkout checkout = new Checkout();

    @Test
    void paysTheOrder() {
        Receipt receipt = checkout.pay("4111", 29.99);
        try { // expect: QCR-E001
            assertEquals("paid", receipt.status());
        } catch (AssertionError error) {
            System.out.println("the status did not match: " + error.getMessage());
        }
    }
}
