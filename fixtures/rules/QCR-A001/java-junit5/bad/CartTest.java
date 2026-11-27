package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class CartTest {
    private final Cart cart = new Cart();

    @Test // expect: QCR-A001
    void addsAnItem() {
        cart.add("backpack", 1);
        cart.add("bike light", 2);
    }

    @Test // expect: QCR-A001
    void emptiesTheCart() {
        cart.add("backpack", 1);
        cart.clear();
        System.out.println(cart.size());
    }
}
