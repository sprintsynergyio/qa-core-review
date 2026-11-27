package shop;

import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertTrue;

import org.junit.Assert;
import org.testng.SkipException;
import org.testng.annotations.AfterClass;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.DataProvider;
import org.testng.annotations.Ignore;
import org.testng.annotations.Test;

public class CartTest extends BaseTest {
    private Cart cart;

    @BeforeClass
    public void loadPrices() {
        Cart.loadPrices("prices.csv");
    }

    @AfterClass
    public void dropPrices() {
        Cart.dropPrices();
    }

    @BeforeMethod
    public void newCart() {
        cart = new Cart();
    }

    @AfterMethod
    public void emptyCart() {
        cart.clear();
    }

    @Test(description = "adds an item to an empty cart")
    public void addsAnItem() {
        cart.add("backpack");
        assertEquals(cart.size(), 1);
    }

    @Test(enabled = false, description = "the coupon service is not ready")
    public void appliesACoupon() {
        cart.apply("SAVE10");
        assertEquals(cart.total(), 26.99);
    }

    @Test(enabled = false)
    public void removesAnItem() {
    }

    @Ignore("the export is rebuilt")
    @Test
    public void exportsTheCart() {
        assertTrue(cart.export().exists());
    }

    @Test(dataProvider = "prices")
    public void hasThePrice(String item, double price) {
        // The assertions of JUnit are used here as a library. TestNG still runs the test.
        Assert.assertEquals(price, Cart.priceOf(item), 0.001);
    }

    @DataProvider(name = "prices")
    public Object[][] itemsAndPrices() {
        return new Object[][] {
            {"backpack", 29.99},
            {"bike-light", 9.99},
        };
    }

    @Test(dataProvider = "coupons")
    public void appliesTheCode(String code, double total) {
        assertEquals(Discount.apply(100, code), total);
    }

    // With no name of its own, a provider is named like its method.
    @DataProvider
    public Object[][] coupons() {
        return new Object[][] {{"SAVE10", 90.0}, {"SAVE20", 80.0}, {"NOPE", 100.0}};
    }

    @Test(dataProvider = "orders", dataProviderClass = OrderRows.class)
    public void totalsTheOrder(int id, double total) {
        assertEquals(Shop.order(id).total(), total);
    }

    @Test
    public void alwaysSkips() {
        throw new SkipException("the importer is switched off");
    }

    @Test
    public void skipsOnOldData() {
        if (Shop.dataVersion() < 3) {
            throw new SkipException("old data");
        }
        assertEquals(Shop.orders().size(), 3);
    }
}
