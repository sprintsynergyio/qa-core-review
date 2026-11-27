package shop;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;

@DisplayName("Cart")
class CartTest {
    private static PriceList prices;
    private Cart cart;

    @BeforeAll
    static void loadPrices() {
        prices = PriceList.load("prices.csv");
    }

    @AfterAll
    static void dropPrices() {
        prices = null;
    }

    @BeforeEach
    void newCart() {
        cart = new Cart(prices);
    }

    @AfterEach
    void emptyCart() {
        cart.clear();
    }

    @Test
    @DisplayName("adds an item")
    void addsAnItem() {
        cart.add("backpack");
        assertEquals(1, cart.size());
        assertEquals(29.99, cart.total());
    }

    @Test
    void startsEmpty() {
        // A comment is not part of the body hash.
        assertTrue(cart.isEmpty());
    }

    @Test
    void startsEmpty(TestInfo info) {
        assertTrue(cart.isEmpty(), info.getDisplayName());
    }

    @Disabled("the coupon service is not ready")
    @Test
    void appliesACoupon() {
        cart.add("backpack");
        cart.apply("SAVE10");
        assertEquals(26.99, cart.total());
    }

    @Test
    @Disabled
    void removesAnItem() {
    }

    @RepeatedTest(5)
    void totalIsStable() {
        cart.add("backpack");
        assertEquals(29.99, cart.total());
    }

    // Not a test: no annotation.
    void helper() {
        cart.add("bike-light");
    }

    @Nested
    @DisplayName("with two items")
    class WithTwoItems {
        @BeforeEach
        void addTwo() {
            cart.add("backpack");
            cart.add("bike-light");
        }

        @Test
        @DisplayName("has the sum as " + "total")
        void total() {
            assertEquals(39.98, cart.total());
        }

        @Nested
        class AfterRemovingOne {
            @Test
            void hasOneItemLeft() {
                cart.remove("backpack");
                assertEquals(1, cart.size());
            }
        }
    }

    @Nested
    @Disabled("checkout is rebuilt")
    class Checkout {
        @Test
        void placesTheOrder() {
            assertEquals("placed", cart.checkout().status());
        }
    }

    @Nested
    class NotWrittenYet {
    }
}
