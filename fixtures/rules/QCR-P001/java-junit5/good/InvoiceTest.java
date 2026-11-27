package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;
import org.approvaltests.Approvals;
import org.approvaltests.JsonApprovals;

class InvoiceTest {
    private final Invoice invoice = new Invoice("order-7");

    @Test
    void printsEveryLine() {
        assertEquals(3, invoice.lines().size());
        Approvals.verifyAll("lines", invoice.lines());
    }
}
