package shop;

import static io.restassured.RestAssured.*;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class CouponsApiTest {
    @Test
    void addsACoupon() {
        given().baseUri("https://api.example.test").body("{\"code\": \"SAVE10\"}") // expect: QCR-C001
            .when().post("/coupons")
            .then().statusCode(201).body("code", equalTo("SAVE10"));
    }
}
