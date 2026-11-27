package shop.support;

import static org.assertj.core.api.Assertions.assertThat;

import shop.Cart;

/** Checks that several test classes share. */
public class Checks {
    public static void cartHasItems(Cart cart, int count) {
        assertThat(cart.size()).isEqualTo(count);
    }

    public void ownerIs(Cart cart, String owner) {
        assertThat(cart.owner()).isEqualTo(owner);
    }

    public static void requireOpen(Cart cart) {
        if (!cart.isOpen()) {
            throw new IllegalStateException("the cart is closed");
        }
    }

    public static String describe(Cart cart) {
        return cart.owner() + ": " + cart.size();
    }
}
