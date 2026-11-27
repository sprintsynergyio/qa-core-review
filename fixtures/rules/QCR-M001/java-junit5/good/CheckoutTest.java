package shop;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CheckoutTest {
    @Mock
    Gateway gateway;

    @InjectMocks
    Checkout checkout;

    @Test
    void addsTheFee() {
        when(gateway.fee("4111")).thenReturn(30);
        assertEquals(1030, checkout.total(1000, "4111"));
    }
}
