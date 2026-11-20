package pay;

import static org.testng.Assert.assertTrue;

import org.testng.annotations.Test;

public class PaymentTest {
    @Test
    public void aPaidPaymentIsRefundable() {
        assertTrue(new Payment("p-1", 1999).isRefundable());
    }
}
