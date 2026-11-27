package shop;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;

class AnimationTest {
    private final Banner banner = new Banner();

    @Test
    void endsTheAnimation() throws InterruptedException {
        banner.start();
        // qa-core-review-disable-next-line QCR-W001 -- the animation has no event to wait for
        Thread.sleep(600);
        assertTrue(banner.isDone());
        assertEquals("sale", banner.text());
    }
}
