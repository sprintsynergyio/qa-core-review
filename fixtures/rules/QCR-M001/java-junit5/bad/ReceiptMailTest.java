package shop;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ReceiptMailTest {
    @Mock
    Mailer mailer;

    @InjectMocks
    Checkout checkout;

    @Test
    void mailsTheReceipt() {
        checkout.pay("4111", 29.99);
        verify(mailer).send("ana", "receipt"); // expect: QCR-M001
    }
}
