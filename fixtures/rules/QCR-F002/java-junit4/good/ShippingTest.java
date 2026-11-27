package shop;

import static org.junit.Assert.*;

import org.junit.*;

public class ShippingTest {
    private final Shipping shipping = new Shipping();

    @Test
    public void shipsAbroad() {
        Assume.assumeTrue("the shipping service is down", shipping.isUp());
        assertEquals(19.99, shipping.cost("abroad"), 0.001);
    }
}
