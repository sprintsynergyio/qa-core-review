package shop;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

// The class under test is `Prices`, by the name of this file. It is replaced by a mock here.
@ExtendWith(MockitoExtension.class)
class PricesTest {
    @Mock Prices prices;

    @Test
    void readsThePriceFromTheMock() {
        when(prices.of("apple")).thenReturn(99);
        assertEquals(99, prices.of("apple"));
    }

    @Test
    void mocksThePricesInTheTest() {
        Prices local = mock(Prices.class);
        when(local.of("pear")).thenReturn(50);
        assertEquals(50, local.of("pear"));
    }

    @Test
    void watchesTheRealPrices() {
        Prices real = spy(new Prices());
        assertEquals(99, real.of("apple"));
    }
}
