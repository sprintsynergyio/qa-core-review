package shop;

import static io.restassured.RestAssured.given;

import org.junit.jupiter.api.Test;

class OrdersApiIT {
    @Test
    void listsOrders() {
        given().baseUri("https://api.example.test")
            .when().get("/orders")
            .then().statusCode(200);
    }
}
