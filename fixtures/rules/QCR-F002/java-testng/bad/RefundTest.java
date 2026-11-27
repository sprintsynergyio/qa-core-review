package shop;

import static org.testng.Assert.*;

import org.testng.annotations.*;

@Test(enabled = false) // expect: QCR-F002
public class RefundTest {
    private final Checkout checkout = new Checkout();

    public void refundsTheOrder() {
        assertEquals(checkout.refund("order-7").status(), "refunded");
    }
}
