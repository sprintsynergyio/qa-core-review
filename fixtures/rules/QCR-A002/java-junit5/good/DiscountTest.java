package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class DiscountTest {
    @Test
    void appliesTenPercent() {
        double price = Discount.apply(100.0, 10);
        assertEquals(90.0, price, 0.001);
    }
}
