package checks;

import static io.restassured.RestAssured.given;

import org.testng.annotations.Test;

public class RefundCheck {
    @Test
    public void refundsAPayment() {
        given().baseUri("https://api.example.test")
            .when().post("/payments/p-1/refund")
            .then().statusCode(202);
    }
}
