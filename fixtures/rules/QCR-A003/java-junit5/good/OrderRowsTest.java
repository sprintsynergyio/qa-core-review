package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;
import java.util.List;

class OrderRowsTest {
    private final OrderStore store = new OrderStore();

    @Test
    void listsTheOrders() {
        List<Order> rows = store.findAll();
        assertEquals(3, rows.size());
    }

    @Test
    void savesAnOrder() {
        store.save(new Order("backpack"));
        assertEquals(1, store.findAll().size());
    }
}
