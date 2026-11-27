package shop;

import static io.restassured.RestAssured.*;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class HealthApiTest {
    @Test
    void pingsTheService() {
        when().get("https://api.example.test/health").then().statusCode(200);
    }
}
