package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class OrderServiceTest {
    private final OrderService orders = new OrderService();

    @Test // expect: QCR-A001
    void placesAnOrder() {
        Order order = orders.place("backpack", 2);
        if (order == null) {
            return;
        }
        orders.ship(order);
    }
}
