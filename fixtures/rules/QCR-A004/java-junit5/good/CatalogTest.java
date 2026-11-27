package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;
import java.util.List;

class CatalogTest {
    private final Catalog catalog = new Catalog();

    @Test
    void everyItemHasAPrice() {
        List<Item> items = catalog.items();
        assertFalse(items.isEmpty());
        for (Item item : items) {
            assertTrue(item.price() > 0);
        }
    }
}
