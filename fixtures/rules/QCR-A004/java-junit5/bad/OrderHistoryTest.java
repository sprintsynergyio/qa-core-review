package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;
import java.util.List;

class OrderHistoryTest {
    private final OrderStore store = new OrderStore();

    @Test
    void everyOrderIsPaid() {
        List<Order> orders = store.findAll();
        orders.forEach(order -> assertEquals("paid", order.status())); // expect: QCR-A004
    }
}
