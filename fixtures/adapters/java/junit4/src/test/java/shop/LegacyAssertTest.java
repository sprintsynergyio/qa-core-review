package shop;

import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.isA;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertThat;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.assertj.core.api.JUnitSoftAssertions;
import org.junit.Assert;
import org.junit.ComparisonFailure;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.ExpectedException;

public class LegacyAssertTest {
    @Rule public final ExpectedException thrown = ExpectedException.none();
    @Rule public final JUnitSoftAssertions softly = new JUnitSoftAssertions();

    private final Cart cart = new Cart("ana");

    @Test
    public void putsTheMessageFirst() {
        cart.add("apple", 2);
        assertEquals("two apples", 2, cart.size());
        assertEquals("the total", 1.98, cart.total(), 0.001);
        assertEquals(1.98, cart.total(), 0.001);
        assertEquals("ana", cart.owner());
        assertTrue("the cart is open", cart.isOpen());
        assertNotNull("the owner", cart.owner());
        Assert.assertNull("no coupon yet", cart.coupon());
        assertThat("the size", cart.size(), is(2));
    }

    @Test(expected = IllegalStateException.class)
    public void expectsTheErrorInTheAnnotation() {
        cart.pay();
    }

    @Test
    public void expectsTheErrorThroughTheRule() {
        thrown.expect(IllegalStateException.class);
        thrown.expectMessage("the cart is empty");
        thrown.expectCause(isA(IllegalArgumentException.class));
        cart.pay();
    }

    @Test
    public void reportsThroughTheRule() {
        softly.assertThat(cart.owner()).isEqualTo("ana");
        softly.assertThat(cart.size()).isZero();
    }

    @Test
    public void swallowsTheComparison() {
        try {
            assertEquals("ana", cart.owner());
        } catch (ComparisonFailure e) {
            cart.clear();
        }
    }

    @Test
    public void isNotWrittenYet() {
        fail("not written yet");
    }
}
