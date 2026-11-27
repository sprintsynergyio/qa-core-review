package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;
import java.util.List;

class CatalogTest {
    private final Catalog catalog = new Catalog();

    @Test
    void everyItemHasAPrice() {
        for (Item item : catalog.items()) {
            assertTrue(item.price() > 0); // expect: QCR-A004
        }
    }
}
