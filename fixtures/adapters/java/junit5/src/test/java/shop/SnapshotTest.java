package shop;

import au.com.origin.snapshots.Expect;
import org.approvaltests.Approvals;
import org.approvaltests.JsonApprovals;
import org.junit.jupiter.api.Test;

class SnapshotTest {
    private final Cart cart = new Cart("ana");
    private Expect expect;

    @Test
    void matchesTheStoredReceipt() {
        Approvals.verify(cart.receipt());
    }

    @Test
    void matchesEveryStoredFormat() {
        Approvals.verifyAll("items", cart.items());
        Approvals.verifyAsJson(cart);
        Approvals.verifyHtml(cart.toHtml());
        Approvals.verifyXml(cart.toXml());
        JsonApprovals.verifyAsJson(cart);
    }

    @Test
    void matchesTheStoredSnapshot() {
        expect.toMatchSnapshot(cart);
    }
}
