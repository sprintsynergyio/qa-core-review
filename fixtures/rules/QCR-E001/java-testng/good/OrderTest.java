package shop;

import static org.testng.Assert.*;

import org.testng.annotations.*;

public class OrderTest {
    @Test
    public void keepsTheStatus() {
        Order order = new Order("backpack");
        try {
            assertEquals(order.status(), "new");
        } catch (AssertionError error) {
            fail("the order did not start as new", error);
        }
    }
}
