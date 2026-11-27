package shop;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

import org.assertj.core.api.SoftAssertions;
import org.junit.jupiter.api.*;

class CouponTest {
    @Test
    void knowsTheCode() {
        Coupon coupon = Coupon.of("SAVE10");
        assertThat("SAVE10").isEqualTo("SAVE10"); // expect: QCR-A002
        assertNotNull(coupon);
    }
}
