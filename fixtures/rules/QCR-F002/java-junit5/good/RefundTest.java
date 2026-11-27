package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.*;

@EnabledIfSystemProperty(named = "shop.refunds", matches = "on")
class RefundTest {
    private final Checkout checkout = new Checkout();

    @Test
    void refundsTheOrder() {
        assertEquals("refunded", checkout.refund("order-7").status());
    }
}
