package shop;

import static org.assertj.core.api.AssertionsForClassTypes.assertThat;
import static org.assertj.core.api.BDDAssertions.then;
import static org.assertj.core.api.SoftAssertions.assertSoftly;

import org.assertj.core.api.AutoCloseableSoftAssertions;
import org.assertj.core.api.BDDSoftAssertions;
import org.assertj.core.api.JUnitJupiterSoftAssertions;
import org.assertj.core.api.SoftAssertions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;

class SoftAssertionsTest {
    @RegisterExtension
    final JUnitJupiterSoftAssertions softly = new JUnitJupiterSoftAssertions();

    private final Cart cart = new Cart("ana");

    @Test
    void reportsAtTheEnd() {
        SoftAssertions soft = new SoftAssertions();
        soft.assertThat(cart.owner()).isEqualTo("ana");
        soft.assertThat(cart.size()).isZero();
        soft.assertAll();
    }

    @Test
    void neverReports() {
        SoftAssertions soft = new SoftAssertions();
        soft.assertThat(cart.owner()).isEqualTo("ana");
        soft.assertThat(cart.size()).isZero();
    }

    @Test
    void neverReportsInBddStyle() {
        BDDSoftAssertions soft = new BDDSoftAssertions();
        soft.then(cart.owner()).isEqualTo("ana");
    }

    @Test
    void reportsWhenTheBlockEnds() {
        try (AutoCloseableSoftAssertions soft = new AutoCloseableSoftAssertions()) {
            soft.assertThat(cart.owner()).isEqualTo("ana");
        }
    }

    @Test
    void reportsThroughTheExtension() {
        softly.assertThat(cart.owner()).isEqualTo("ana");
        softly.assertThat(cart.size()).isZero();
    }

    @Test
    void reportsInsideTheCallback() {
        assertSoftly(all -> {
            all.assertThat(cart.owner()).isEqualTo("ana");
            all.assertThat(cart.isEmpty()).isTrue();
        });
    }

    @Test
    void readsLikeASentence() {
        then(cart.owner()).isEqualTo("ana");
        assertThat(cart.size()).isZero();
    }
}
