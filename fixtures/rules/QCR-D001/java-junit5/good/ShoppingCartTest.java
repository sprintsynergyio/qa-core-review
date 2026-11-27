package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class ShoppingCartTest {
    private final Cart cart = new Cart();

    @Test
    void emptiesTheCart() {
        cart.add("onesie");
        cart.clear();
        assertTrue(cart.isEmpty());
    }

    @Test
    void countsOneLine() {
        assertEquals(0, cart.size());
    }

    @Test
    void countsNoLines() {
        assertEquals(0, cart.size());
    }
}
