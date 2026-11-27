package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class RegionTest {
    @BeforeEach
    void pickTheRegion() {
        System.setProperty("shop.region", "eu"); // expect: QCR-C001
    }

    @Test
    void addsTheTax() {
        assertEquals(1.21, Prices.withTax(1.0), 0.001);
    }
}
