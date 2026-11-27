package shop;

import static org.testng.Assert.*;

import org.testng.annotations.*;

public class ShippingTest {
    private final Shipping shipping = new Shipping();

    @Ignore // expect: QCR-F002
    @Test
    public void shipsAbroad() {
        assertEquals(shipping.cost("abroad"), 19.99);
    }
}
