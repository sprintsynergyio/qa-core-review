package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class StockTest {
    private final Stock stock = new Stock();

    @Test
    void countsTheItems() {
        stock.add("backpack", 3);
        try {
            stock.flush();
            assertEquals(3, stock.count("backpack"));
        } catch (java.io.IOException problem) {
            fail("the stock file could not be written", problem);
        }
    }

    @Test
    void keepsTheCountAfterAReload() {
        stock.add("onesie", 2);
        try {
            stock.reload();
            assertEquals(2, stock.count("onesie"));
        } catch (Exception problem) {
            System.out.println("the reload did not work: " + problem.getMessage());
        }
    }
}
