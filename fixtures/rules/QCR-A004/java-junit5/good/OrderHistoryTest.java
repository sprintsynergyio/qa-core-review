package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;
import java.util.List;

class OrderHistoryTest {
    private final OrderStore store = new OrderStore();

    @Test
    void everyOrderIsPaid() {
        List<Order> orders = store.findAll();
        assertEquals(2, orders.size());
        orders.forEach(order -> assertEquals("paid", order.status()));
    }

    @Test
    void everyKnownUserHasOrders() {
        for (String user : List.of("ana", "ben")) {
            assertFalse(store.findBy(user).isEmpty());
        }
    }
}
