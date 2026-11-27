package shop;

import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertEqualsDeep;
import static org.testng.Assert.assertEqualsNoOrder;
import static org.testng.Assert.assertThrows;
import static org.testng.Assert.assertTrue;
import static org.testng.Assert.expectThrows;

import java.util.Map;
import org.testng.Assert;
import org.testng.AssertJUnit;
import org.testng.annotations.Test;
import org.testng.asserts.SoftAssert;

public class AssertOrderTest {
    private final Cart cart = new Cart("ana");

    @Test
    public void putsTheActualValueFirst() {
        cart.add("apple", 2);
        assertEquals(cart.size(), 2);
        assertEquals(cart.owner(), "ana", "the owner");
        assertTrue(cart.isOpen(), "the cart is open");
        assertEqualsNoOrder(cart.names(), new String[] {"apple"});
        assertEqualsDeep(cart.quantities(), Map.of("apple", 2));
        Assert.assertNotNull(cart.first());
        Assert.assertEquals(cart.total(), 1.98, 0.001);
    }

    @Test
    public void putsTheExpectedValueFirstInTheJUnitStyle() {
        AssertJUnit.assertEquals("the owner", "ana", cart.owner());
        AssertJUnit.assertEquals(0, cart.size());
    }

    @Test
    public void expectsErrors() {
        assertThrows(IllegalStateException.class, () -> cart.pay());
        IllegalStateException error = expectThrows(IllegalStateException.class, () -> cart.pay());
        assertEquals(error.getMessage(), "the cart is empty");
    }

    @Test(expectedExceptions = IllegalStateException.class)
    public void expectsTheErrorInTheAnnotation() {
        cart.pay();
    }

    @Test
    public void reportsAtTheEnd() {
        SoftAssert soft = new SoftAssert();
        soft.assertEquals(cart.owner(), "ana");
        soft.assertTrue(cart.isEmpty());
        soft.assertAll();
    }

    @Test
    public void neverReports() {
        SoftAssert soft = new SoftAssert();
        soft.assertEquals(cart.owner(), "ana");
        soft.assertTrue(cart.isEmpty());
    }

    @Test
    public void isNotWrittenYet() {
        Assert.fail("not written yet");
    }
}
