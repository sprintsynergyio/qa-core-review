package shop;

import static org.junit.jupiter.api.Assertions.assertFalse;

import org.junit.jupiter.api.Test;

// A test interface: every class that implements it gets these tests.
interface ShapeContract {
    Item item();

    @Test
    default void hasAName() {
        assertFalse(item().name().isEmpty());
    }

    @Test
    default void hasAPrice() {
        assertFalse(item().price() < 0);
    }
}
