package shop;

import static org.awaitility.Awaitility.await;
import static org.awaitility.Awaitility.waitAtMost;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.client.RestTemplate;

class OrderStoreTest {
    private static final String API = "https://api.example.test";
    private JdbcTemplate jdbc;
    private OrderRepository orderRepository;
    private OrderRepo orderRepo;
    private OrderDao orderDao;
    private RestTemplate restTemplate;
    private ApiClient apiClient;
    private Connection connection;

    @BeforeEach
    void useTheTestMode() throws Exception {
        System.setProperty("shop.mode", "test");
        connection = DriverManager.getConnection("jdbc:h2:mem:shop");
    }

    @AfterEach
    void cleanUp() throws Exception {
        System.clearProperty("shop.mode");
        orderRepository.deleteAll();
        connection.close();
    }

    @Test
    void storesAnOrderWithSql() throws Exception {
        jdbc.update("INSERT INTO orders (id, item) VALUES (7, 'apple')");
        jdbc.update("UPDATE orders SET item = 'pear' WHERE id = 7");
        assertEquals("pear", jdbc.queryForObject("SELECT item FROM orders WHERE id = 7", String.class));
        assertEquals(1, jdbc.queryForList("SELECT id FROM orders").size());
        assertEquals(1, jdbc.query("SELECT id FROM orders", new OrderMapper()).size());
        jdbc.execute("DELETE FROM orders WHERE id = 7");
        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate("DELETE FROM orders");
            assertTrue(statement.executeQuery("SELECT count(*) FROM orders").next());
        }
        assertEquals(0, entityManager().createNativeQuery("SELECT id FROM orders").getResultList().size());
    }

    @Test
    void storesAnOrderThroughTheRepository() {
        orderRepository.save(new Order(7, "apple"));
        orderRepo.insert(new Order(8, "pear"));
        orderDao.persist(new Order(9, "fig"));
        orderRepo.delete(8);
        orderDao.remove(9);
        assertEquals(1, orderRepository.count());
    }

    @Test
    void createsAnOrderOverHttp() {
        Order created = restTemplate.postForObject(API + "/orders", new Order(7, "apple"), Order.class);
        restTemplate.postForEntity(API + "/orders", new Order(8, "pear"), Order.class);
        restTemplate.postForLocation(API + "/orders", new Order(9, "fig"));
        assertEquals("apple", restTemplate.getForObject(API + "/orders/7", Order.class).item());
        assertEquals(200, restTemplate.getForEntity(API + "/orders/8", Order.class).getStatusCode().value());
        assertEquals(7, created.id());
    }

    @Test
    void createsAnOrderWithOtherClients(ShopHttp http, ShopHttp httpClient, ShopHttp rest, ShopHttp webClient, ShopHttp webTestClient) {
        apiClient.post("/orders", new Order(7, "apple"));
        http.put("/orders/7", new Order(7, "pear"));
        httpClient.patch("/orders/7", "{\"item\": \"fig\"}");
        rest.head("/orders/7");
        webClient.get("/orders/7");
        webTestClient.delete("/orders/7");
        assertEquals(0, orderRepository.count());
    }

    @Test
    void changesAPropertyAndLeavesIt() {
        System.setProperty("shop.currency", "EUR");
        assertEquals("EUR", Prices.currency());
    }

    @Test
    void waitsUntilTheOrderIsStored() {
        AtomicBoolean stored = new AtomicBoolean();
        AtomicInteger count = new AtomicInteger();
        orderRepository.saveLater(new Order(7, "apple"), stored, count);
        await().atMost(Duration.ofSeconds(5)).untilTrue(stored);
        await().untilFalse(new AtomicBoolean(false));
        waitAtMost(Duration.ofSeconds(5)).untilAtomic(count, org.hamcrest.Matchers.equalTo(1));
        assertEquals(1, orderRepository.count());
    }
}
