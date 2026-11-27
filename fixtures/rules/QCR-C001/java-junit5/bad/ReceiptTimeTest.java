package shop;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.time.Instant;

class ReceiptTimeTest {
    private static final Instant NOON = Instant.parse("2026-01-05T12:00:00Z");

    @Test
    void printsTheTime() {
        MockedStatic<Clock> clock = mockStatic(Clock.class); // expect: QCR-C001
        clock.when(Clock::now).thenReturn(NOON);
        assertEquals("12:00", new Receipt().time());
    }
}
