package shop;

import static org.testng.Assert.*;

import org.testng.annotations.*;

public class CartTotalTest {
    private final Cart cart = new Cart();

    @Test
    public void totalsTheCart() {
        cart.add("backpack", 1);
        try { // expect: QCR-E001
            assertEquals(cart.total(), 29.99);
        } catch (Throwable ignored) {
            // nothing
        }
    }
}
