package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class CartTest {
    private final Cart cart = new Cart();

    @Test
    void addsAnItem() {
        cart.add("backpack", 1);
        assertEquals(1, cart.size());
    }

    @Test
    void emptiesTheCart() {
        cart.add("backpack", 1);
        cart.clear();
        assertTrue(cart.isEmpty());
    }

    @Test
    void rejectsANegativeQuantity() {
        assertThrows(IllegalArgumentException.class, () -> cart.add("backpack", -1));
    }
}
