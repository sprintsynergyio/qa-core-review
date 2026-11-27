package shop;

import static io.restassured.RestAssured.*;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class ProductsApiTest { // expect: QCR-N001
    @Test
    void listsTheProducts() {
        when().get("https://api.example.test/products").then().statusCode(200);
    }

    @Test
    void readsAProduct() {
        when().get("https://api.example.test/products/7").then().statusCode(200).body("name", equalTo("backpack"));
    }
}
