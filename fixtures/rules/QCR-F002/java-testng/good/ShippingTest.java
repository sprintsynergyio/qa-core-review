package shop;

import static org.testng.Assert.*;

import org.testng.annotations.*;

public class ShippingTest {
    private final Shipping shipping = new Shipping();

    @Test(groups = "slow")
    public void shipsAbroad() {
        assertEquals(shipping.cost("abroad"), 19.99);
    }
}
