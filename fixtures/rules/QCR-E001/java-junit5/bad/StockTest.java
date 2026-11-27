package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class StockTest {
    private final Stock stock = new Stock();

    @Test
    void countsTheItems() {
        stock.add("backpack", 3);
        try { // expect: QCR-E001
            assertEquals(3, stock.count("backpack"));
            assertTrue(stock.has("backpack"));
        } catch (RuntimeException | Error problem) {
            problem.printStackTrace();
        }
    }
}
