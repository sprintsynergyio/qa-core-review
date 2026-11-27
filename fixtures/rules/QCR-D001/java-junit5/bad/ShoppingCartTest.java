package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class ShoppingCartTest {
    private final Cart cart = new Cart();

    @Test // expect: QCR-D001
    void addsOneItem() {
        cart.add("apple");
        assertEquals(1, cart.size());
    }

    @Test
    void removesAnItem() {
        cart.add("apple");
        cart.remove("apple");
        assertTrue(cart.isEmpty());
    }
}
