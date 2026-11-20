package shop;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CartTest {
    @Test
    @DisplayName("adds an item")
    void addsAnItem() {
        Cart cart = new Cart();
        cart.add(29.99);
        assertEquals(1, cart.size());
        assertEquals(29.99, cart.total());
    }

    @Test
    void startsEmpty() {
        Cart cart = new Cart();
        cart.size();
    }
}
