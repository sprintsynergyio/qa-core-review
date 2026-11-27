package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.*;

class ShippingTest {
    private final Shipping shipping = new Shipping();

    @Test
    void shipsToTheNextTown() {
        assertEquals(4.99, shipping.cost("next town"), 0.001);
    }

    @Test
    @DisabledOnOs(OS.WINDOWS)
    void shipsAbroad() {
        assertEquals(19.99, shipping.cost("abroad"), 0.001);
    }

    @Test
    void shipsOnlyWhenTheServiceIsUp() {
        Assumptions.assumeTrue(shipping.isUp(), "the shipping service is down");
        assertEquals(9.99, shipping.cost("far town"), 0.001);
    }
}
