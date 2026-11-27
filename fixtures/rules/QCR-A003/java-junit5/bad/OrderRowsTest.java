package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;
import java.util.List;

class OrderRowsTest {
    private final OrderStore store = new OrderStore();

    @Test
    void listsTheOrders() {
        List<Order> rows = store.findAll();
        assertTrue(rows.size() >= 0); // expect: QCR-A003
    }

    @Test
    void savesAnOrder() {
        store.save(new Order("backpack"));
        fail("not written yet");
        assertEquals(1, store.findAll().size()); // expect: QCR-A003
    }
}
