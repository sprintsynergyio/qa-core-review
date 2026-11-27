package shop;

import com.github.tomakehurst.wiremock.WireMockServer;

// No import of the annotations: they are written with their full names.
class QualifiedTest {
    private final WireMockServer server = new WireMockServer(8089);

    @org.junit.jupiter.api.BeforeEach
    void start() {
        server.start();
    }

    @org.junit.jupiter.api.AfterEach
    void stop() {
        server.stop();
    }

    @org.junit.jupiter.api.Test
    @org.junit.jupiter.api.Disabled("the stub server is replaced")
    void answersFromTheStub() {
        org.junit.jupiter.api.Assertions.assertTrue(server.isRunning());
    }

    @org.junit.jupiter.api.Test
    void skipsWithoutAPort() {
        org.junit.jupiter.api.Assumptions.assumeTrue(server.port() > 0, "no free port");
        org.junit.jupiter.api.Assertions.assertEquals(8089, server.port());
    }
}
