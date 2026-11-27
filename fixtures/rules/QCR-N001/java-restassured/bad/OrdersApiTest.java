package shop;

import static io.restassured.RestAssured.*;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class OrdersApiTest { // expect: QCR-N001
    @Test
    void listsTheOrders() {
        given().baseUri("https://api.example.test").get("/orders").then().statusCode(200).body("items", hasSize(2));
    }

    @Test
    void readsAnOrder() {
        given().baseUri("https://api.example.test").get("/orders/7").then().statusCode(200).body("item", equalTo("backpack"));
    }
}
