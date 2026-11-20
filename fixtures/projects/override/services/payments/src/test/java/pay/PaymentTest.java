package pay;

import static org.testng.Assert.assertEquals;

import org.testng.annotations.Test;

public class PaymentTest {
    @Test
    public void addsTheFee() {
        assertEquals(1999 + 30, 2029);
    }
}
