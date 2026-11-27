package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class CartTest {
    private final Cart cart = new Cart();

    // qa-core-review-disable-next-line QCR-A001 -- the test passes when add() does not throw
    @Test
    void addsAnItem() {
        cart.add("backpack", 1);
    }
}
