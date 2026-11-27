package shop;

import static org.testng.Assert.*;

import org.testng.annotations.*;

public class CartTest {
    private final Cart cart = new Cart();

    @Test // expect: QCR-A001
    public void addsAnItem() {
        cart.add("backpack", 1);
        cart.add("bike light", 2);
    }
}
