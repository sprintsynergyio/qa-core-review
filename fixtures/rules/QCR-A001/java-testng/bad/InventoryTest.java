package shop;

import static org.testng.Assert.*;

import org.testng.annotations.*;

public class InventoryTest {
    private final Inventory inventory = new Inventory();

    @Test(dataProvider = "names") // expect: QCR-A001
    public void findsTheItem(String name) {
        Item item = inventory.find(name);
        inventory.reserve(item);
    }

    @DataProvider
    public Object[][] names() {
        return new Object[][] {{"backpack"}, {"onesie"}};
    }
}
