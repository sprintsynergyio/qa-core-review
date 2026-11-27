package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class CouponTest {
    private final Cart cart = new Cart();

    @Test
    @DisplayName("applies a coupon of ten percent")
    void appliesTenPercent() {
        cart.add("bike light");
        assertEquals(8.99, cart.apply("SAVE10"), 0.001);
    }

    @Test
    @DisplayName("applies a coupon of twenty percent")
    void appliesTwentyPercent() {
        cart.add("bike light");
        assertEquals(7.99, cart.apply("SAVE20"), 0.001);
    }
}
