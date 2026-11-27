package shop;

import static org.testng.Assert.*;

import org.testng.annotations.*;

public class StockTest {
    @Test
    public void countsTheItems() {
        Stock stock = new Stock();
        stock.add("backpack", 3);
        assertFalse(false); // expect: QCR-A002
    }
}
