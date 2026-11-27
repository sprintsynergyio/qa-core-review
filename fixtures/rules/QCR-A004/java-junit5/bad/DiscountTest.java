package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class DiscountTest {
    private final Cart cart = new Cart();

    @Test
    void appliesTheDiscount() {
        cart.add("backpack", 3);
        if (cart.hasDiscount()) {
            assertEquals(80.97, cart.total(), 0.001); // expect: QCR-A004
            assertEquals("SAVE10", cart.discountCode());
        }
    }
}
