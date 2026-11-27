package shop;

import static io.restassured.RestAssured.*;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class UsersApiTest {
    @Test
    void readsAUser() {
        String name = given().baseUri("https://api.example.test").get("/users/2").jsonPath().getString("name");
        assertEquals("ben", name);
    }

    @Test
    void refusesAPageBelowOne() {
        given().baseUri("https://api.example.test").queryParam("page", 0).get("/users").then().statusCode(400).body("message", equalTo("page starts at 1"));
    }
}
