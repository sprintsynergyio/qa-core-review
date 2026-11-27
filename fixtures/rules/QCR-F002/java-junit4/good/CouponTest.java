package shop;

import static org.junit.Assert.*;

import org.junit.*;

public class CouponTest {
    private final Cart cart = new Cart();

    @Test
    public void appliesACoupon() {
        assertEquals(9.0, cart.apply("SAVE10"), 0.001);
    }
}
