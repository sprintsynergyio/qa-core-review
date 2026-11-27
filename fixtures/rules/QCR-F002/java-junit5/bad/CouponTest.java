package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class CouponTest {
    private final Cart cart = new Cart();

    @Disabled // expect: QCR-F002
    @Test
    void appliesACoupon() {
        assertEquals(9.0, cart.apply("SAVE10"), 0.001);
    }

    @Test // expect: QCR-F002
    @Disabled("the coupon service is down")
    void refusesAnExpiredCoupon() {
        assertThrows(IllegalStateException.class, () -> cart.apply("OLD"));
    }
}
