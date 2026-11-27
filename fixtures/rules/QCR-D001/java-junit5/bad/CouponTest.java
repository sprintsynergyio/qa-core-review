package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class CouponTest {
    private final Cart cart = new Cart();

    @Test
    @DisplayName("applies a coupon")
    void appliesTenPercent() {
        cart.add("backpack");
        assertEquals(26.99, cart.apply("SAVE10"), 0.001);
    }

    @Test // expect: QCR-D001
    @DisplayName("applies a coupon")
    void appliesTwentyPercent() {
        cart.add("backpack");
        assertEquals(23.99, cart.apply("SAVE20"), 0.001);
    }
}
