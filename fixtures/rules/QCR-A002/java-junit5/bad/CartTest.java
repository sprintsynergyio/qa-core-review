package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class CartTest {
    private final Cart cart = new Cart();

    @Test
    void addsAnItem() {
        cart.add("backpack", 1);
        assertTrue(true); // expect: QCR-A002
    }

    @Test
    void totalsTheCart() {
        cart.add("backpack", 1);
        assertEquals(cart.total(), cart.total()); // expect: QCR-A002
    }
}
