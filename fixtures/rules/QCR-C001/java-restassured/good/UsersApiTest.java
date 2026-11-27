package shop;

import static io.restassured.RestAssured.*;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class UsersApiTest {
    private String id;

    @AfterEach
    void removeTheUser() {
        given().baseUri("https://api.example.test").delete("/users/" + id);
    }

    @Test
    void registersAUser() {
        id = given().baseUri("https://api.example.test").body("{\"name\": \"ana\"}").post("/users").then().statusCode(201).extract().path("id");
        assertNotNull(id);
    }
}
