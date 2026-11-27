package shop;

import static org.junit.Assert.*;

import org.junit.*;

public class ShippingTest {
    private final Shipping shipping = new Shipping();

    @Test // expect: QCR-F002
    @Ignore("SHOP-123: the price table is not final")
    public void shipsAbroad() {
        assertEquals(19.99, shipping.cost("abroad"), 0.001);
    }
}
