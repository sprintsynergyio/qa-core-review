package shop;

import static org.junit.Assert.assertEquals;

import java.util.List;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;

@RunWith(Parameterized.class)
public class DiscountTableTest {
    @Parameterized.Parameter(0)
    public String code;

    @Parameterized.Parameter(1)
    public double price;

    @Parameterized.Parameters(name = "{0}")
    public static List<Object[]> rows() {
        return List.of(new Object[] {"SAVE10", 90.0}, new Object[] {"SAVE20", 80.0});
    }

    @Test
    public void appliesTheCode() {
        assertEquals(price, Discount.apply(100, code), 0.001);
    }
}

// The rows come from a file, so their number is not known here.
@RunWith(Parameterized.class)
class LoadedDiscountTableTest {
    @Parameterized.Parameters
    public static Iterable<Object[]> rows() {
        return Discount.loadRows("discounts.csv");
    }

    @Test
    public void appliesTheCode() {
        assertEquals(90.0, Discount.apply(100, "SAVE10"), 0.001);
    }
}
