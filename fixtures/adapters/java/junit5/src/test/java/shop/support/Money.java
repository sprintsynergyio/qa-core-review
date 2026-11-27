package shop.support;

import java.math.BigDecimal;
import java.math.RoundingMode;

// A utility under src/test with no test and no hook: a support file with no suite.
public final class Money {
    private Money() {
    }

    public static BigDecimal of(double amount) {
        return BigDecimal.valueOf(amount).setScale(2, RoundingMode.HALF_UP);
    }

    public static String describe(double amount) {
        // The text below looks like a test and is not one.
        return "@Test void " + of(amount) + "() {}";
    }
}
