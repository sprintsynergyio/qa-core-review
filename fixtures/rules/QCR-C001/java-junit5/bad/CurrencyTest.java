package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class CurrencyTest {
    @Test
    void usesEuros() {
        System.setProperty("shop.currency", "EUR"); // expect: QCR-C001
        assertEquals("EUR", Prices.currency());
    }
}
