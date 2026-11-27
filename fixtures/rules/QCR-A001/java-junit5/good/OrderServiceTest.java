package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class OrderServiceTest {
    private final OrderService orders = new OrderService();

    @Test
    void placesAnOrder() {
        Order order = orders.place("backpack", 2);
        orders.ship(order);
        assertEquals("shipped", order.status());
    }

    @Test
    void failsOnAnUnknownItem() {
        Order order = orders.place("unknown", 1);
        if (order != null) {
            fail("an unknown item was ordered");
        }
    }
}
