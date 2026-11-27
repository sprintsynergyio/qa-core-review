package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class CheckoutTest {
    private final Checkout checkout = new Checkout();

    @Test
    void paysTheOrder() {
        Receipt receipt = checkout.pay("4111", 29.99);
        try {
            assertEquals("paid", receipt.status());
        } catch (AssertionError error) {
            System.out.println("the status did not match: " + error.getMessage());
            throw error;
        }
    }

    @Test
    void refusesAnEmptyCard() {
        try {
            checkout.pay("", 29.99);
            fail("an empty card was accepted");
        } catch (IllegalArgumentException expected) {
            assertEquals("card number is empty", expected.getMessage());
        }
    }
}
