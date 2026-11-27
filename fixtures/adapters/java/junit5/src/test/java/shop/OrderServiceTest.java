package shop;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.mockito.Mockito.mock;

import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OrderServiceTest extends BaseTest {
    private OrderService service;

    @BeforeEach
    void newService() {
        service = new OrderService(database, mock(Mailer.class));
    }

    @Test
    void placesAnOrder() {
        Order order = service.place("backpack");
        assertThat(order.status()).isEqualTo("placed");
    }

    @Test
    void findsAnOrder() {
        assertThat(order(7).status(), is("placed"));
    }

    @Test
    void shipsInTheBackground() {
        service.ship(7);
        Awaitility.await().until(() -> order(7).status().equals("shipped"));
    }

    // A static class inside a test class is found by JUnit as a class of its own.
    static class Totals {
        @Test
        void addsTheTax() {
            assertThat(new OrderService(null, null).totalOf(29.99)).isEqualTo(32.39);
        }
    }
}
