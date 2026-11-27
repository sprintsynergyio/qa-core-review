package shop;

import static io.restassured.RestAssured.*;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class UsersApiTest { // expect: QCR-N001
    @Test
    void readsAUser() {
        String name = given().baseUri("https://api.example.test").get("/users/1").jsonPath().getString("name");
        assertEquals("ana", name);
    }

    @Test
    void listsTheUsers() {
        given().baseUri("https://api.example.test").get("/users").then().statusCode(200).body("size()", greaterThan(0));
    }
}
