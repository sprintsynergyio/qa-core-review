package shop;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willAnswer;
import static org.mockito.BDDMockito.willDoNothing;
import static org.mockito.BDDMockito.willReturn;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import shop.mail.Mailer;
import shop.pay.PaymentGateway;

@ExtendWith(MockitoExtension.class)
class CheckoutServiceTest {
    @Mock PaymentGateway gateway;
    @Mock Mailer mailer;
    @Spy Audit audit;
    @InjectMocks CheckoutService checkout;

    @BeforeEach
    void acceptEveryCard() {
        when(gateway.charge(anyString(), any())).thenReturn(Receipt.paid("r-1"));
    }

    @Test
    void chargesTheCardAndSendsAReceipt() {
        Receipt receipt = checkout.pay(new Cart("ana"), "4111");
        assertEquals("r-1", receipt.id());
        verify(mailer).send("ana", "receipt");
    }

    @Test
    void onlyWatchesTheMailer() {
        checkout.pay(new Cart("ana"), "4111");
        verify(mailer).send("ana", "receipt");
        verify(audit).record(any());
    }

    @Test
    void checksTheReplyItGaveItself() {
        when(gateway.fee("4111")).thenReturn(30);
        assertEquals(30, gateway.fee("4111"));
    }

    @Test
    void givesRepliesInEveryStyle() {
        Stock stock = mock(Stock.class);
        Prices prices = mock(Prices.class, CALLS_REAL_METHODS);
        given(stock.has("apple")).willReturn(true);
        doReturn(3).when(stock).count("apple");
        doThrow(new IllegalStateException("sold out")).when(stock).take("fig");
        doAnswer(call -> 1).when(stock).count("pear");
        doNothing().when(mailer).flush();
        willReturn(2).given(stock).count("plum");
        willThrow(new IllegalStateException("sold out")).given(stock).take("kiwi");
        willAnswer(call -> 1).given(stock).count("lime");
        willDoNothing().given(mailer).flush();
        doReturn(7).when(audit).size();
        when(prices.of("apple")).thenCallRealMethod();
        given(prices.of("pear")).willCallRealMethod();
        assertTrue(checkout.canShip(new Cart("ana"), stock, prices));
    }
}
