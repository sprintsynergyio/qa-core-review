package shop;

import static com.google.common.truth.Truth.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.springframework.test.web.servlet.MockMvc;
import reactor.test.StepVerifier;

class OrdersControllerTest {
    @Autowired MockMvc mockMvc;
    @Autowired WebTestClient client;
    @Autowired OrderStream orders;

    @Test
    void listsTheOrders() throws Exception {
        mockMvc.perform(get("/orders")).andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(7));
    }

    @Test
    void rejectsAnUnknownOrder() throws Exception {
        mockMvc.perform(get("/orders/0")).andExpectAll(status().is(404), jsonPath("$.error").value("not found"));
    }

    @Test
    void readsOneOrder() {
        client.get().uri("/orders/7").exchange()
            .expectStatus().isOk()
            .expectHeader().contentType("application/json")
            .expectCookie().doesNotExist("session")
            .expectBody().jsonPath("$.id").isEqualTo(7);
    }

    @Test
    void readsManyOrders() {
        client.get().uri("/orders").exchange().expectStatus().isEqualTo(200).expectBodyList(Order.class).hasSize(2);
    }

    @Test
    void onlyPrintsTheAnswer() throws Exception {
        mockMvc.perform(get("/orders")).andDo(result -> System.out.println(result));
    }

    @Test
    void streamsTheOrders() {
        StepVerifier.create(orders.all()).expectNextCount(2).verifyComplete();
    }

    @Test
    void neverRunsTheVerifier() {
        StepVerifier.create(orders.all()).expectNextCount(2).expectComplete();
    }

    @Test
    void readsLikeTruth() {
        assertThat(new Cart("ana").owner()).isEqualTo("ana");
    }
}
