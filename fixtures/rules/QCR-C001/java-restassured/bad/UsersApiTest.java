package shop;

import static io.restassured.RestAssured.*;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class UsersApiTest {
    @Test
    void registersAUser() {
        String id = given().baseUri("https://api.example.test").body("{\"name\": \"ana\"}").post("/users").then().statusCode(201).extract().path("id"); // expect: QCR-C001
        assertNotNull(id);
    }
}
