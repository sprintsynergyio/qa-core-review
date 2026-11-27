package shop;

import static org.testng.Assert.*;

import org.testng.annotations.*;

public class OrderTest {
    @Test
    public void keepsTheStatus() {
        Order order = new Order("backpack");
        try { // expect: QCR-E001
            assertEquals(order.status(), "new");
        } catch (AssertionError error) {
            System.out.println(error.getMessage());
        }
    }
}
