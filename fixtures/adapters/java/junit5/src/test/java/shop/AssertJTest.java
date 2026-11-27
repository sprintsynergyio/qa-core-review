package shop;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;
import static org.assertj.core.api.Assertions.assertThatIOException;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.assertj.core.api.Assertions.assertThatIllegalStateException;
import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.assertj.core.api.Assertions.assertThatNullPointerException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.assertj.core.api.Assertions.fail;
import static org.assertj.core.api.Assertions.within;
import static org.awaitility.Awaitility.await;

import java.math.BigDecimal;
import java.util.Comparator;
import org.assertj.core.api.InstanceOfAssertFactories;
import org.junit.jupiter.api.Test;

class AssertJTest {
    private final Cart cart = new Cart("ana");

    @Test
    void comparesValues() {
        cart.add("apple", 2);
        assertThat(cart.size()).isEqualTo(2);
        assertThat(cart.owner()).as("the owner").isNotEqualTo("guest").isEqualToIgnoringCase("ANA");
        assertThat(cart.self()).isSameAs(cart).isNotSameAs(new Cart("ana"));
        assertThat(cart.total()).isEqualByComparingTo(new BigDecimal("1.98")).isCloseTo(new BigDecimal("2"), within(new BigDecimal("0.1")));
        assertThat(cart.first()).hasToString("apple x2");
        assertThat(cart.discount()).isZero();
        assertThat(cart.size()).isNotZero().isPositive().isBetween(1, 5);
        assertThat(cart.balance()).isNegative();
    }

    @Test
    void checksTruthAndNull() {
        assertThat(cart.isOpen()).isTrue();
        assertThat(cart.isEmpty()).describedAs("nothing was added").isFalse();
        assertThat(cart.coupon()).isNull();
        assertThat(cart.owner()).isNotNull();
        assertThat(cart.find("apple")).isPresent();
        assertThat(cart.find("pear")).isNotPresent();
    }

    @Test
    void checksWhatACollectionHolds() {
        cart.add("apple", 2);
        cart.add("pear", 1);
        assertThat(cart.names()).hasSize(2).contains("apple").doesNotContain("fig");
        assertThat(cart.names()).containsExactly("apple", "pear").containsExactlyInAnyOrder("pear", "apple").containsOnly("apple", "pear").containsAnyOf("apple", "fig");
        assertThat(cart.quantities()).containsKey("apple").containsEntry("apple", 2).containsValue(1);
        assertThat(cart.owner()).containsIgnoringCase("AN").startsWith("a").endsWith("a");
        assertThat(cart.owner()).isIn("ana", "ben").isNotIn("guest");
        assertThat(cart.names()).isNotEmpty().hasSameSizeAs(cart.items());
        assertThat(cart.coupons()).isEmpty();
        assertThat(cart.notes()).isNullOrEmpty();
    }

    @Test
    void comparesNumbersAndTypes() {
        assertThat(cart.size()).isGreaterThan(-1).isGreaterThanOrEqualTo(0).isLessThan(10).isLessThanOrEqualTo(9);
        assertThat(cart.first()).isInstanceOf(Item.class).isNotInstanceOf(Coupon.class).isExactlyInstanceOf(Item.class).hasSameClassAs(cart.last());
    }

    @Test
    void movesToAnotherValueFirst() {
        assertThat(cart.items()).extracting("name").contains("apple");
        assertThat(cart.items()).flatExtracting(Item::tags).doesNotContain("frozen");
        assertThat(cart.items()).first().isNotNull();
        assertThat(cart.items()).last().isNotNull();
        assertThat(cart.items()).element(0).isNotNull();
        assertThat(cart.items()).singleElement().isNotNull();
        assertThat(cart.items()).filteredOn(item -> item.price() > 1).isEmpty();
        assertThat(cart.items()).map(Item::name).contains("apple");
        assertThat(cart.items()).size().isGreaterThan(0);
        assertThat(cart.total()).asString().isEqualTo("1.98");
        assertThat(cart.items()).asList().hasSize(1);
        assertThat(cart.first()).asInstanceOf(InstanceOfAssertFactories.type(Item.class)).isNotNull();
        assertThat(cart).usingRecursiveComparison().ignoringFields("id").isEqualTo(new Cart("ana"));
        assertThat(cart.owner()).usingComparator(Comparator.naturalOrder()).isEqualTo("ana");
        assertThat(cart.owner()).usingDefaultComparator().isEqualTo("ana");
        assertThat(cart.names()).usingElementComparator(String.CASE_INSENSITIVE_ORDER).contains("APPLE");
        assertThat(cart.size()).withFailMessage("the cart is empty").isPositive();
        assertThat(cart.size()).overridingErrorMessage("the cart is empty").isPositive();
        assertThat(cart.id()).withRepresentation(String::valueOf).inHexadecimal().withThreadDumpOnError().isNotNull();
    }

    @Test
    void checksInsideACallback() {
        assertThat(cart).satisfies(c -> assertThat(c.owner()).isEqualTo("ana"));
        assertThat(cart).matches(Cart::isOpen);
        await().untilAsserted(() -> assertThat(cart.isSaved()).isTrue());
        cart.items().forEach(item -> assertThat(item.price()).isPositive());
    }

    @Test
    void expectsErrors() {
        assertThatThrownBy(() -> cart.pay()).isInstanceOf(IllegalStateException.class).hasMessage("the cart is empty");
        assertThatExceptionOfType(EmptyCartException.class).isThrownBy(() -> cart.pay());
        assertThatIllegalArgumentException().isThrownBy(() -> cart.add("apple", -1));
        assertThatIllegalStateException().isThrownBy(() -> cart.pay());
        assertThatNullPointerException().isThrownBy(() -> cart.add(null, 1));
        assertThatIOException().isThrownBy(() -> cart.export("/missing"));
        assertThatCode(() -> cart.pay()).isInstanceOf(IllegalStateException.class);
        Throwable thrown = catchThrowable(() -> cart.pay());
        assertThat(thrown).hasMessage("the cart is empty");
    }

    @Test
    void expectsNoError() {
        assertThatNoException().isThrownBy(() -> cart.clear());
        assertThatCode(() -> cart.clear()).doesNotThrowAnyException();
    }

    @Test
    void forgetsTheCheck() {
        assertThat(cart.isOpen());
        assertThat(cart.owner()).as("the owner");
        assertThatExceptionOfType(EmptyCartException.class);
        assertThatCode(() -> cart.clear());
    }

    @Test
    void isNotWrittenYet() {
        fail("not written yet");
    }
}
