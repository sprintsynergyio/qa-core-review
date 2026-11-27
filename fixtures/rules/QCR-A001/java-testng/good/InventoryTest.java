package shop;

import static org.testng.Assert.*;

import org.testng.annotations.*;

public class InventoryTest {
    private final Inventory inventory = new Inventory();

    @Test(dataProvider = "names")
    public void findsTheItem(String name) {
        Item item = inventory.find(name);
        assertNotNull(item);
    }

    @DataProvider
    public Object[][] names() {
        return new Object[][] {{"backpack"}, {"onesie"}};
    }
}
