package shop;

import static org.testng.Assert.*;

import org.testng.annotations.*;

@Test
public class CheckoutTest {
    private final Checkout checkout = new Checkout();

    public void paysTheOrder() { // expect: QCR-A001
        Receipt receipt = checkout.pay("4111", 29.99);
        System.out.println(receipt);
    }
}
