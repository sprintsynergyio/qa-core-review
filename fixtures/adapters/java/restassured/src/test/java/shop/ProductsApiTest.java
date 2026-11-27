package shop;

import static io.restassured.RestAssured.given;
import static io.restassured.RestAssured.when;
import static org.hamcrest.Matchers.anyOf;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.lessThan;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;

import io.restassured.response.Response;
import io.restassured.specification.ResponseSpecification;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ProductsApiTest {
    private static final String API = "https://api.example.test";
    private ResponseSpecification okJson;

    @Test
    void listsTheProducts() {
        given().baseUri(API).when().get("/products").then()
            .statusCode(200)
            .contentType("application/json")
            .body("items", hasSize(3))
            .body("items[0].price", greaterThan(0f));
    }

    @Test
    void rejectsAnUnknownProduct() {
        when().get(API + "/products/0").then().statusCode(404).body("error", containsString("not found"));
    }

    @Test
    void acceptsTwoStatusCodes() {
        given().baseUri(API).delete("/products/7").then().statusCode(anyOf(is(200), is(204)));
    }

    @Test
    void readsTheHeadOfTheAnswer() {
        given().baseUri(API).get("/products").then().assertThat()
            .statusLine(containsString("200"))
            .header("Cache-Control", "no-store")
            .headers("X-Shop", "eu", "X-Page", notNullValue())
            .cookie("session", not(equalTo("")))
            .cookies(Map.of("region", "eu"))
            .time(lessThan(2000L))
            .content(containsString("apple"))
            .spec(okJson);
    }

    @Test
    void onlyLogsTheAnswer() {
        given().baseUri(API).get("/products").then().log().all();
    }

    @Test
    void readsTheStatusByHand() {
        Response response = given().baseUri(API).get("/products");
        assertEquals(200, response.statusCode());
        assertEquals(3, response.jsonPath().getList("items").size());
    }

    @Test
    void checksAStoredAnswer() {
        Response response = given().baseUri(API).get("/products/7");
        response.then().statusCode(200).body("name", equalTo("apple"));
    }
}
