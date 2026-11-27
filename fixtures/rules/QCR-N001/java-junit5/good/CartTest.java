package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class CartTest {
    private final Cart cart = new Cart();

    @Test
    void addsAnItem() {
        cart.add("bike light", 2);
        assertEquals(2, cart.size());
    }

    @Test
    void rejectsANegativeQuantity() {
        assertThrows(IllegalArgumentException.class, () -> cart.add("backpack", -1));
    }
}
