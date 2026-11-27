package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class CheckoutTest {
    private final Checkout checkout = new Checkout();

    @Test
    void paysTheOrder() {
        assertEquals("paid", checkout.pay("4111", 29.99).status());
    }

    @Test
    void rejectsADeclinedCard() {
        assertEquals("declined", checkout.pay("4000", 29.99).status());
    }
}
