package shop;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

import org.assertj.core.api.SoftAssertions;
import org.junit.jupiter.api.*;

class SoftCartTest {
    private final Cart cart = new Cart();

    @Test
    void describesTheCart() {
        cart.add("backpack", 2);
        SoftAssertions softly = new SoftAssertions();
        softly.assertThat(cart.owner()).isEqualTo("ana"); // expect: QCR-A003
        softly.assertThat(cart.size()).isEqualTo(2); // expect: QCR-A003
    }
}
