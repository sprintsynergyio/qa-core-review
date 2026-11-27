package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class ShippingTest {
    private final Shipping shipping = new Shipping();

    @Test
    void shipsToTheNextTown() {
        assertEquals(4.99, shipping.cost("next town"), 0.001);
    }

    @Disabled // expect: QCR-F002
    @Test
    void shipsAbroad() {
        assertEquals(19.99, shipping.cost("abroad"), 0.001);
    }
}
