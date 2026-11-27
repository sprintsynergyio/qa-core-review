package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class DiscountTest {
    private final Cart cart = new Cart();

    @Test
    void appliesTheDiscount() {
        cart.add("backpack", 3);
        assertTrue(cart.hasDiscount());
        assertEquals(80.97, cart.total(), 0.001);
    }

    @Test
    void checksEveryPartOfTheCart() {
        cart.add("backpack", 1);
        assertAll(
            () -> assertEquals(1, cart.size()),
            () -> assertEquals(29.99, cart.total(), 0.001));
    }
}
