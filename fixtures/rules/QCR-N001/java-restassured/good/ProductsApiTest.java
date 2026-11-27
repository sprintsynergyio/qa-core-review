package shop;

import static io.restassured.RestAssured.*;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class ProductsApiTest {
    @Test
    void listsTheProducts() {
        when().get("https://api.example.test/products").then().statusCode(200);
    }

    @Test
    void needsAToken() {
        when().get("https://api.example.test/products/7/stock").then().statusCode(401);
    }
}
