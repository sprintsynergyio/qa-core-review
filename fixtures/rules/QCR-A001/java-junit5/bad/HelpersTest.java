package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class HelpersTest {
    private final Cart cart = new Cart();

    @Test // expect: QCR-A001
    void printsTheCart() {
        cart.add("backpack", 1);
        printCart(cart);
    }

    private void printCart(Cart cart) {
        System.out.println(cart);
    }
}
