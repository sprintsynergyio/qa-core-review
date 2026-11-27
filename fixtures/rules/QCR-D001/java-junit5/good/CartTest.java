package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class CartTest {
    private final Cart cart = new Cart();

    @ParameterizedTest
    @ValueSource(strings = {"apple", "pear"})
    void addsAnItem(String name) {
        cart.add(name);
        assertEquals(1, cart.size());
    }

    @Test
    void addsTwoOfAKind() {
        cart.add("plum");
        cart.add("plum");
        assertEquals(2, cart.size());
    }
}
