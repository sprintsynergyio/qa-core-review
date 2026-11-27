package shop;

import static com.github.tomakehurst.wiremock.client.WireMock.any;
import static com.github.tomakehurst.wiremock.client.WireMock.anyUrl;
import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.post;
import static com.github.tomakehurst.wiremock.client.WireMock.postRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.stubFor;
import static com.github.tomakehurst.wiremock.client.WireMock.urlEqualTo;
import static com.github.tomakehurst.wiremock.client.WireMock.urlMatching;
import static com.github.tomakehurst.wiremock.client.WireMock.verify;
import static io.restassured.RestAssured.given;
import static io.restassured.RestAssured.when;
import static io.restassured.RestAssured.with;
import static org.hamcrest.Matchers.equalTo;

import com.github.tomakehurst.wiremock.WireMockServer;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OrderLifecycleApiTest {
    private static final String API = "https://api.example.test";
    private WireMockServer payments;

    @BeforeEach
    void startThePaymentStub() {
        payments = new WireMockServer(8089);
        payments.start();
    }

    @AfterEach
    void stopThePaymentStub() {
        payments.stop();
    }

    @Test
    void createsAnOrderAndLeavesIt() {
        given().baseUri(API).body("{\"item\": \"apple\"}").when().post("/orders").then().statusCode(201);
    }

    @Test
    void createsAnOrderAndDeletesIt() {
        String id = given().baseUri(API).body("{\"item\": \"apple\"}").post("/orders").then().statusCode(201).extract().path("id");
        with().baseUri(API).body("{\"item\": \"pear\"}").put("/orders/" + id).then().statusCode(200);
        given().baseUri(API).body("{\"quantity\": 2}").patch("/orders/" + id).then().body("quantity", equalTo(2));
        given().baseUri(API).head("/orders/" + id).then().statusCode(200);
        when().delete(API + "/orders/" + id).then().statusCode(204);
    }

    @Test
    void fakesThePaymentService() {
        stubFor(post(urlEqualTo("/payments")).willReturn(aResponse().withStatus(201)));
        given().baseUri(API).post("/orders/7/pay").then().statusCode(200);
        verify(postRequestedFor(urlEqualTo("/payments")));
    }

    @Test
    void fakesEveryService() {
        stubFor(any(anyUrl()).willReturn(aResponse().withStatus(200)));
        stubFor(any(urlMatching(".*")).willReturn(aResponse().withStatus(200)));
        stubFor(post(urlMatching("/.*")).willReturn(aResponse().withStatus(200)));
        given().baseUri(API).get("/orders").then().statusCode(200);
    }

    @Test
    void startsAServerAndNeverStopsIt() throws Exception {
        MockWebServer stock = new MockWebServer();
        stock.enqueue(new MockResponse().setBody("{\"apple\": 3}"));
        MockWebServer prices = new MockWebServer();
        prices.shutdown();
        given().baseUri(API).get("/stock").then().statusCode(200);
    }
}
