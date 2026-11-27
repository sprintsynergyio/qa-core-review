package shop;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.verifyZeroInteractions;
import static org.mockito.Mockito.when;

import jakarta.inject.Inject;
import javax.annotation.Resource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

@ExtendWith(MockitoExtension.class)
class MailerTest {
    @Mock Mailer mailer;
    @Spy Audit audit;
    @MockBean Clock clock;
    @SpyBean Ledger ledger;
    @MockitoBean Stock stock;
    @MockitoSpyBean Prices prices;
    @Inject Checkout checkout;
    @Resource Receipts receipts;

    @Test
    void sendsOneReceipt() {
        checkout.pay(new Cart("ana"));
        verify(mailer).send("ana", "receipt");
        verify(audit, times(1)).record(any());
    }

    @Test
    void sendsNothingForAnEmptyCart() {
        Sms sms = mock(Sms.class);
        checkout.pay(new Cart("ana"));
        verify(mailer, never()).send("ana", "receipt");
        verifyNoInteractions(sms);
        verifyNoMoreInteractions(mailer);
        verifyZeroInteractions(ledger);
    }

    @Test
    void namesNoCall() {
        checkout.pay(new Cart("ana"));
        verify(mailer);
    }

    @Test
    void readsLikeASentence() {
        checkout.pay(new Cart("ana"));
        then(mailer).should().send("ana", "receipt");
        then(mailer).should(never()).send("ben", "receipt");
        then(clock).shouldHaveNoInteractions();
        then(stock).shouldHaveNoMoreInteractions();
        then(prices).shouldHaveZeroInteractions();
    }

    @Test
    void checksOnlyTheMock() {
        when(mailer.sent()).thenReturn(1);
        assertEquals(1, mailer.sent());
    }

    @Test
    void wrapsARealCart() {
        Cart cart = spy(new Cart("ana"));
        checkout.pay(cart);
        verify(cart).clear();
        assertEquals(0, cart.size());
    }

    @Test
    void replacesStaticAndNewObjects() {
        try (MockedStatic<Prices> fixed = mockStatic(Prices.class); MockedConstruction<Cart> carts = mockConstruction(Cart.class)) {
            checkout.pay(new Cart("ana"));
            fixed.verify(() -> Prices.of("apple"));
            assertEquals(1, carts.constructed().size());
        }
    }
}
