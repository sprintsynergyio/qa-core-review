package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class CouponTest {
    private final Cart cart = new Cart();

    @Test
    void appliesACoupon() {
        assertEquals(9.0, cart.apply("SAVE10"), 0.001);
    }

    @Test
    void refusesAnExpiredCoupon() {
        assertThrows(IllegalStateException.class, () -> cart.apply("OLD"));
    }
}
