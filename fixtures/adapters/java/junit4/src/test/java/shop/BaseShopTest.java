package shop;

import org.junit.AfterClass;
import org.junit.BeforeClass;

// A base class in a support file.
public abstract class BaseShopTest {
    protected static Shop shop;

    @BeforeClass
    public static void openShop() {
        shop = Shop.open();
    }

    @AfterClass
    public static void closeShop() {
        shop.close();
    }
}
