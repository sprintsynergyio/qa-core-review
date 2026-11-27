package shop;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assume.assumeFalse;
import static org.junit.Assume.assumeNoException;
import static org.junit.Assume.assumeNotNull;
import static org.junit.Assume.assumeThat;
import static org.junit.Assume.assumeTrue;
import static org.hamcrest.CoreMatchers.is;

import org.junit.After;
import org.junit.AfterClass;
import org.junit.Assume;
import org.junit.AssumptionViolatedException;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Ignore;
import org.junit.Test;

public class CartTest {
    private static PriceList prices;
    private Cart cart;

    @BeforeClass
    public static void loadPrices() {
        prices = PriceList.load("prices.csv");
    }

    @AfterClass
    public static void dropPrices() {
        prices = null;
    }

    @Before
    public void newCart() {
        cart = new Cart(prices);
    }

    @After
    public void emptyCart() {
        cart.clear();
    }

    @Test
    public void addsAnItem() {
        cart.add("backpack");
        assertEquals(1, cart.size());
    }

    @Test(expected = IllegalArgumentException.class)
    public void refusesAnUnknownItem() {
        cart.add("no-such-item");
    }

    @Test(timeout = 500)
    public void totalIsFast() {
        assertEquals(0.0, cart.total(), 0.001);
    }

    @Ignore("the coupon service is not ready")
    @Test
    public void appliesACoupon() {
        cart.apply("SAVE10");
        assertEquals(26.99, cart.total(), 0.001);
    }

    @Test
    @Ignore
    public void removesAnItem() {
    }

    @Test
    public void refundsOnLinuxOnly() {
        assumeTrue("refunds are tested on Linux only", Shop.isLinux());
        assertEquals(29.99, Shop.refund(7).amount(), 0.001);
    }

    @Test
    public void skipsWithoutADatabase() {
        assumeFalse(Shop.flag("refunds").isOff());
        assumeNotNull(Shop.database());
        assumeThat(Shop.dataVersion(), is(3));
        Assume.assumeTrue(Shop.hasDatabase());
        assertTrue(Shop.refund(8).closed());
    }

    @Test
    public void skipsWhenTheSetupFails() {
        try {
            Shop.connect();
        } catch (IllegalStateException e) {
            assumeNoException(e);
        }
        assertTrue(Shop.connected());
    }

    @Test
    public void alwaysSkips() {
        throw new AssumptionViolatedException("the importer is switched off");
    }
}
