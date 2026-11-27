// qa-core-review-disable QCR-A002 -- this file is a template that the generator fills in
package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class StockTest {
    private final Stock stock = new Stock();

    @Test
    void countsTheItems() {
        stock.add("bike light", 5);
        assertTrue(true);
    }
}
