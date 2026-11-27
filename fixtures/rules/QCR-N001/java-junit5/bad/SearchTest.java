package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class SearchTest { // expect: QCR-N001
    private final Catalog catalog = new Catalog();

    @Test
    void findsAnItemByName() {
        assertEquals(1, catalog.search("backpack").size());
    }

    @Test
    void sortsByPrice() {
        assertEquals("onesie", catalog.sortedByPrice().get(0).name());
    }
}
