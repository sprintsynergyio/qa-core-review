package shop;

import static org.testng.Assert.*;

import org.testng.annotations.*;

public class CartTest {
    private final Cart cart = new Cart();

    @Test
    public void addsAnItem() {
        cart.add("backpack", 1);
        assertEquals(cart.size(), 1);
    }

    @Test(expectedExceptions = IllegalArgumentException.class)
    public void rejectsANegativeQuantity() {
        cart.add("backpack", -1);
    }
}
