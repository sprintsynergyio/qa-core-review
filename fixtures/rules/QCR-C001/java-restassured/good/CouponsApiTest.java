package shop;

import static io.restassured.RestAssured.*;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class CouponsApiTest {
    @Test
    void addsACoupon() {
        given().baseUri("https://api.example.test").body("{\"code\": \"SAVE20\"}")
            .when().post("/coupons")
            .then().statusCode(201).body("code", equalTo("SAVE20"));
        when().delete("https://api.example.test/coupons/SAVE20").then().statusCode(204);
    }
}
