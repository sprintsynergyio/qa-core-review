package shop;

import static io.restassured.RestAssured.*;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class OrdersApiTest {
    @Test // expect: QCR-A001
    void listsTheOrders() {
        given().baseUri("https://api.example.test").get("/orders").then().log().all();
    }
}
