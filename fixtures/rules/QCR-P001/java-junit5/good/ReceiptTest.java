package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;
import org.approvaltests.Approvals;
import org.approvaltests.JsonApprovals;

class ReceiptTest {
    private final Cart cart = new Cart();

    @Test
    void printsTheReceipt() {
        cart.add("backpack", 1);
        assertEquals(29.99, cart.total(), 0.001);
        Approvals.verify(cart.receipt());
    }
}
