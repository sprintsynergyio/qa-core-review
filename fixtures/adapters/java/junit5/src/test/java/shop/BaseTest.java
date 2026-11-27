package shop;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;

// A base class in a support file: its hooks run for every test class that extends it.
abstract class BaseTest {
    protected Database database;

    @BeforeEach
    void openDatabase() {
        database = Database.inMemory();
        database.load("orders.sql");
    }

    @AfterEach
    void closeDatabase() {
        database.close();
    }

    protected Order order(int id) {
        return database.find(Order.class, id);
    }
}
