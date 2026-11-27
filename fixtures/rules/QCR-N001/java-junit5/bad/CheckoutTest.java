package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class CheckoutTest { // expect: QCR-N001
    private final Checkout checkout = new Checkout();

    @Test
    void paysTheOrder() {
        assertEquals("paid", checkout.pay("4111", 29.99).status());
    }

    @Test
    void printsTheReceipt() {
        assertTrue(checkout.pay("4111", 29.99).text().contains("29.99"));
    }

    @Test
    void keepsTheCard() {
        assertEquals("4111", checkout.pay("4111", 29.99).card());
    }
}
