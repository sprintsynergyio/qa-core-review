package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class SearchTest {
    private final Catalog catalog = new Catalog();

    @Test
    void findsAnItemByName() {
        assertEquals(1, catalog.search("backpack").size());
    }

    @Test
    void findsNothingForAnEmptyText() {
        assertTrue(catalog.search("").isEmpty());
    }
}
