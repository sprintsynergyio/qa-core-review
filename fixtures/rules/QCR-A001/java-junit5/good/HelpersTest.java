package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class HelpersTest {
    private final Cart cart = new Cart();

    @Test
    void checksTheCartInAHelper() {
        cart.add("bike light", 1);
        checkTotal(cart, 9.99);
    }

    @Test
    void checksTheCartByName() {
        cart.add("onesie", 1);
        assertCartHasItems(cart);
    }

    private void checkTotal(Cart cart, double expected) {
        assertEquals(expected, cart.total(), 0.001);
    }
}
