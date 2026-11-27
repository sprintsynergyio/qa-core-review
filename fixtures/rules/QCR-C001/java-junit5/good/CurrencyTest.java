package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class CurrencyTest {
    @AfterEach
    void clearTheCurrency() {
        System.clearProperty("shop.currency");
    }

    @Test
    void usesPounds() {
        System.setProperty("shop.currency", "GBP");
        assertEquals("GBP", Prices.currency());
    }
}
