package shop;

import static io.restassured.RestAssured.*;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class ProductsApiTest {
    @Test // expect: QCR-A001
    void readsAProduct() {
        String name = given().baseUri("https://api.example.test").get("/products/7").jsonPath().getString("name");
        System.out.println(name);
    }
}
