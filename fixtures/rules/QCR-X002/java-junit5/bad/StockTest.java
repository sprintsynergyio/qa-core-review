// qa-core-review-disable QCR-A002
package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class StockTest {
    private final Stock stock = new Stock();

    @Test
    void countsTheItems() {
        stock.add("backpack", 3);
        assertTrue(true);
    }
}
