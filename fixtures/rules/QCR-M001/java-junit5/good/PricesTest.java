package shop;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PricesTest {
    @Mock
    PriceTable table;

    @InjectMocks
    Prices prices;

    @Test
    void readsThePrice() {
        when(table.lookup("apple")).thenReturn(99);
        assertEquals(99, prices.of("apple"));
    }
}
