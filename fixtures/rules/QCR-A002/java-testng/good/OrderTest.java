package shop;

import static org.testng.Assert.*;

import org.testng.annotations.*;

public class OrderTest {
    @Test
    public void keepsTheStatus() {
        Order order = new Order("backpack");
        assertEquals(order.status(), "new");
    }
}
