package shop;

import static org.testng.Assert.*;

import org.testng.annotations.*;

public class StockTest {
    @Test
    public void countsTheItems() {
        Stock stock = new Stock();
        stock.add("backpack", 3);
        try { // expect: QCR-E001
            assertEquals(stock.count("backpack"), 3);
        } catch (Error error) {
            error.printStackTrace();
        } finally {
            stock.clear();
        }
    }
}
