package shop;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;

import java.util.Arrays;
import java.util.Collection;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;
import org.junit.runners.Parameterized.Parameters;

// Every test of this class runs once for each row.
@RunWith(Parameterized.class)
public class PriceTableTest {
    private final String item;
    private final double price;

    public PriceTableTest(String item, double price) {
        this.item = item;
        this.price = price;
    }

    @Parameters
    public static Collection<Object[]> rows() {
        return Arrays.asList(new Object[][] {
            {"backpack", 29.99},
            {"bike-light", 9.99},
            {"onesie", 7.99},
        });
    }

    @Test
    public void hasThePrice() {
        assertEquals(price, Cart.priceOf(item), 0.001);
    }

    @Test
    public void hasAName() {
        assertNotNull(Cart.nameOf(item));
    }
}
