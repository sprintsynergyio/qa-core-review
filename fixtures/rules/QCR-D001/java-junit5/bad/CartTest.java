package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class CartTest {
    private final Cart cart = new Cart();

    @Test
    void addsAnApple() {
        cart.add("apple");
        assertEquals(1, cart.size());
    }

    @Test // expect: QCR-D001
    void addsAPear() {
        cart.add("apple");
        assertEquals(1, cart.size());
    }
}
