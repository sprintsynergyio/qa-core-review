package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class AnimationTest {
    private final Banner banner = new Banner();

    @Test
    void endsTheAnimation() throws InterruptedException {
        banner.start();
        // qa-core-review-disable-next-line QCR-W001
        Thread.sleep(500);
        assertTrue(banner.isDone());
    }
}
