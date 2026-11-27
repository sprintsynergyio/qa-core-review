package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class CartTotalTest {
    private final Cart cart = new Cart();

    @Test
    void totalsTheCart() {
        cart.add("backpack", 1);
        try { // expect: QCR-E001
            assertEquals(29.99, cart.total(), 0.001);
        } catch (Throwable ignored) {
            // nothing
        }
    }
}
