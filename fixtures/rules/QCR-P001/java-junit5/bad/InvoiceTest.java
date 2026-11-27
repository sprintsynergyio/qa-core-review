package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;
import org.approvaltests.Approvals;
import org.approvaltests.JsonApprovals;

class InvoiceTest {
    private final Invoice invoice = new Invoice("order-7");

    @Test
    void printsEveryLine() {
        Approvals.verifyAll("lines", invoice.lines()); // expect: QCR-P001
        Approvals.verifyHtml(invoice.html());
    }
}
