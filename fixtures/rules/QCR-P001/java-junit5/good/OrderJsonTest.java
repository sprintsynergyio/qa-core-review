package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;
import org.approvaltests.Approvals;
import org.approvaltests.JsonApprovals;

class OrderJsonTest {
    @Test
    void writesTheOrderAsJson() {
        Order order = new Order("backpack");
        assertEquals("new", order.status());
        JsonApprovals.verifyAsJson(order);
    }
}
