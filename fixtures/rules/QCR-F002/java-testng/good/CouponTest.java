package shop;

import static org.testng.Assert.*;

import org.testng.annotations.*;

public class CouponTest {
    private final Cart cart = new Cart();

    @Test
    public void appliesACoupon() {
        assertEquals(cart.apply("SAVE10"), 9.0);
    }
}
