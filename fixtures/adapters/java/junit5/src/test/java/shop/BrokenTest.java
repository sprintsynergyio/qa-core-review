package shop;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class BrokenTest {
    @Test
    void beforeTheError() {
        assertEquals(1, new Cart().add("backpack").size());
    }

    @Test
    void withTheError() {
        Cart cart = new Cart(;
        assertEquals(0, cart.size());
    }

    @Test
    void afterTheError() {
        assertEquals(0, new Cart().size());
    }
}
