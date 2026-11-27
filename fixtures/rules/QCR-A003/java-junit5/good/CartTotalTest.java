package shop;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

import org.assertj.core.api.SoftAssertions;
import org.junit.jupiter.api.*;

class CartTotalTest {
    private final Cart cart = new Cart();

    @Test
    void totalsTheCart() {
        cart.add("backpack", 1);
        assertThat(cart.total()).isEqualTo(29.99);
    }

    @Test
    void keepsTheOwner() {
        cart.assignTo("ana");
        assertThat(cart.owner()).as("owner").isEqualTo("ana");
    }
}
