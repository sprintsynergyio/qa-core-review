package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class DiscountTest {
    @Test
    void appliesTenPercent() {
        double price = Discount.apply(100.0, 10);
        assertEquals(90.0, 90.0); // expect: QCR-A002
        System.out.println(price);
    }
}
