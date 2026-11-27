package shop;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

import io.restassured.RestAssured;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.DataProvider;
import org.testng.annotations.Test;

public class OrdersApiTest {
    @BeforeClass
    public void baseUrl() {
        RestAssured.baseURI = "https://api.example.test";
    }

    @Test
    public void listsTheOrders() {
        given().when().get("/orders").then().statusCode(200);
    }

    @Test(dataProvider = "ids")
    public void readsOneOrder(int id) {
        given().pathParam("id", id).when().get("/orders/{id}").then().statusCode(200).body("id", equalTo(id));
    }

    @DataProvider
    public static Object[][] ids() {
        return new Object[][] {{7}, {8}};
    }
}
