package shop;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;
import static org.junit.jupiter.api.Assertions.assertLinesMatch;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertThrowsExactly;
import static org.junit.jupiter.api.Assertions.assertTimeout;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AssertionsTest {
    private final Cart cart = new Cart();
    private final HttpClient client = new HttpClient("https://api.example.test");

    @BeforeEach
    void startsEmpty() {
        assertTrue(cart.isEmpty(), "a new cart has no items");
    }

    @Test
    void comparesValues() {
        cart.add("apple", 2);
        assertEquals(2, cart.size());
        assertEquals(1.98, cart.total(), 0.001, "two apples");
        assertNotEquals("guest", cart.owner());
        assertSame(cart, cart.self());
        assertNotSame(cart, new Cart());
        assertArrayEquals(new String[] {"apple"}, cart.names());
        assertIterableEquals(List.of("apple"), cart.items());
        assertLinesMatch(List.of("apple x2"), cart.lines());
    }

    @Test
    void readsConditions() {
        cart.add("apple", 2);
        assertTrue(cart.size() >= 0);
        assertTrue(0 < cart.size());
        assertFalse(cart.owner() == null);
        assertTrue(!cart.owner().equals("guest"));
        assertTrue(cart.first() instanceof Item);
        assertNull(cart.coupon());
        assertNotNull(cart.first());
        assertInstanceOf(Item.class, cart.first());
        assert cart.size() == 2 : "two apples";
    }

    @Test
    void expectsErrors() {
        assertThrows(IllegalStateException.class, () -> cart.pay());
        assertThrowsExactly(EmptyCartException.class, cart::pay, "an empty cart cannot be paid");
        assertDoesNotThrow(() -> cart.clear());
        assertTimeout(Duration.ofSeconds(1), () -> cart.clear());
        assertTimeoutPreemptively(Duration.ofSeconds(1), () -> assertTrue(cart.isEmpty()));
    }

    @Test
    void groupsChecks() {
        cart.add("pear", 1);
        assertAll(
            () -> assertEquals(1, cart.size()),
            () -> assertEquals("pear", cart.first().name()));
    }

    @Test
    void readsTheStatus() {
        Response created = client.post("/orders", cart);
        assertEquals(201, created.statusCode());
        assertEquals(404, client.get("/orders/0").getStatusCode());
        assertTrue(client.get("/orders").getStatus() == 200);
        assertEquals(200, client.get("/health").code());
        assertEquals(204, client.delete("/orders/7").getStatusCodeValue());
    }

    @Test
    void checksOnlySometimes() {
        if (cart.isEmpty()) {
            assertEquals(0, cart.total());
        }
        for (Item item : cart.items()) {
            assertNotNull(item.name());
        }
        cart.items().forEach(item -> assertTrue(item.price() > 0));
        boolean open = cart.isOpen() && cart.owner() != null;
        String label = open ? cart.owner() : "nobody";
        switch (label) {
            case "nobody" -> assertTrue(cart.isEmpty());
            default -> assertNotNull(cart.owner());
        }
    }

    @Test
    void checksEveryListedName() {
        for (String name : List.of("apple", "pear")) {
            cart.add(name, 1);
            assertTrue(cart.has(name));
        }
        for (String name : Arrays.asList("fig", "plum")) {
            assertFalse(cart.has(name));
        }
        for (int quantity : Set.of(1, 2)) {
            assertTrue(quantity > 0);
        }
        for (String code : new String[] {"B2"}) {
            assertNotNull(code);
        }
        do {
            assertNotNull(cart.owner());
        } while (cart.next());
    }

    @Test
    void failsWhenTheCartIsClosed() {
        if (!cart.isOpen()) fail("the cart is closed");
        if (cart.owner() == null) {
            throw new IllegalStateException("no owner");
        }
        cart.add("apple", 1);
    }

    @Test
    void stopsBeforeTheCheck() {
        cart.add("apple", 1);
        return;
        assertEquals(1, cart.size());
    }

    @Test
    void isNotWrittenYet() {
        fail("not written yet");
        assertEquals(1, cart.size());
    }
}
