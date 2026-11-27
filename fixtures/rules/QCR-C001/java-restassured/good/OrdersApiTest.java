package shop;

import static io.restassured.RestAssured.*;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class OrdersApiTest {
    @Test
    void createsAnOrder() {
        String id = given().baseUri("https://api.example.test").body("{\"item\": \"backpack\"}").post("/orders").then().statusCode(201).extract().path("id");
        given().baseUri("https://api.example.test").delete("/orders/" + id).then().statusCode(204);
    }
}
