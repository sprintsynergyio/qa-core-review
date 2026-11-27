package shop;

import org.testng.annotations.AfterSuite;
import org.testng.annotations.AfterTest;
import org.testng.annotations.BeforeSuite;
import org.testng.annotations.BeforeTest;

// A base class in a support file. These hooks run once for many classes.
public abstract class BaseTest {
    protected static Shop shop;

    @BeforeSuite
    public void startShop() {
        shop = Shop.start();
    }

    @AfterSuite
    public void stopShop() {
        shop.stop();
    }

    @BeforeTest
    public void seedData() {
        shop.seed("orders.sql");
    }

    @AfterTest
    public void dropData() {
        shop.drop();
    }
}
