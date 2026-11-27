package shop;

import static org.testng.Assert.*;

import org.testng.annotations.*;

public class CartTest {
    private final Cart cart = new Cart();

    @Test
    public void totalsTheCart() {
        cart.add("backpack", 1);
        assertEquals(cart.total(), 29.99);
    }
}
