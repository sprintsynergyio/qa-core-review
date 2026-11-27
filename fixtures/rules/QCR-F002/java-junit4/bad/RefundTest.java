package shop;

import static org.junit.Assert.*;

import org.junit.*;

@Ignore // expect: QCR-F002
public class RefundTest {
    private final Checkout checkout = new Checkout();

    @Test
    public void refundsTheOrder() {
        assertEquals("refunded", checkout.refund("order-7").status());
    }
}
