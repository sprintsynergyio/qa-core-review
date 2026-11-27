package shop;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.closeTo;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.describedAs;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.emptyArray;
import static org.hamcrest.Matchers.emptyIterable;
import static org.hamcrest.Matchers.emptyString;
import static org.hamcrest.Matchers.endsWith;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.equalToIgnoringCase;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasEntry;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.hasValue;
import static org.hamcrest.Matchers.instanceOf;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.isA;
import static org.hamcrest.Matchers.lessThan;
import static org.hamcrest.Matchers.lessThanOrEqualTo;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.oneOf;
import static org.hamcrest.Matchers.sameInstance;
import static org.hamcrest.Matchers.startsWith;

import org.junit.jupiter.api.Test;

class HamcrestTest {
    private final Cart cart = new Cart("ana");

    @Test
    void comparesValues() {
        assertThat(cart.size(), is(0));
        assertThat(cart.owner(), is(equalTo("ana")));
        assertThat(cart.owner(), not("guest"));
        assertThat(cart.owner(), is(not(equalToIgnoringCase("GUEST"))));
        assertThat(cart.self(), sameInstance(cart));
        assertThat(cart.total(), closeTo(0.0, 0.001));
        assertThat("the coupon", cart.coupon(), nullValue());
        assertThat(cart.owner(), notNullValue());
        assertThat(cart.owner(), describedAs("the owner of the cart", equalTo("ana")));
    }

    @Test
    void checksWhatACollectionHolds() {
        cart.add("apple", 2);
        assertThat(cart.names(), hasItem("apple"));
        assertThat(cart.names(), hasItems("apple"));
        assertThat(cart.names(), contains("apple"));
        assertThat(cart.names(), containsInAnyOrder("apple"));
        assertThat(cart.names(), hasSize(1));
        assertThat(cart.quantities(), hasKey("apple"));
        assertThat(cart.quantities(), hasEntry("apple", 2));
        assertThat(cart.quantities(), hasValue(2));
        assertThat(cart.owner(), containsString("an"));
        assertThat(cart.owner(), startsWith("a"));
        assertThat(cart.owner(), endsWith("a"));
        assertThat(cart.owner(), oneOf("ana", "ben"));
    }

    @Test
    void checksEmptiness() {
        assertThat(cart.items(), is(empty()));
        assertThat(cart.coupons(), emptyIterable());
        assertThat(cart.note(), emptyString());
        assertThat(cart.tags(), emptyArray());
        assertThat(cart.names(), not(empty()));
    }

    @Test
    void comparesNumbersAndTypes() {
        assertThat(cart.size(), greaterThan(-1));
        assertThat(cart.size(), greaterThanOrEqualTo(0));
        assertThat(cart.size(), lessThan(10));
        assertThat(cart.size(), lessThanOrEqualTo(9));
        assertThat(cart.first(), instanceOf(Item.class));
        assertThat(cart.first(), isA(Item.class));
    }
}
