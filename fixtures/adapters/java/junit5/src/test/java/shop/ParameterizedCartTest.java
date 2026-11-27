package shop;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.DynamicTest.dynamicTest;

import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;
import org.junit.jupiter.api.TestTemplate;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.ArgumentsSource;
import org.junit.jupiter.params.provider.CsvFileSource;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EmptySource;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.FieldSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

class ParameterizedCartTest {
    static final List<String> ITEMS = List.of("backpack", "bike-light");

    @ParameterizedTest
    @ValueSource(ints = {1, 2, 3})
    void addsThatManyItems(int count) {
        assertEquals(count, Cart.with("backpack", count).size());
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = "backpack")
    void knowsTheItem(String item) {
        assertNotNull(Cart.priceOf(item));
    }

    @ParameterizedTest
    @CsvSource({"backpack, 29.99", "bike-light, 9.99"})
    void hasThePrice(String item, double price) {
        assertEquals(price, Cart.priceOf(item));
    }

    @ParameterizedTest
    @CsvSource(value = {"backpack; 29.99", "bike-light; 9.99", "onesie; NONE"}, delimiter = ';', nullValues = "NONE", emptyValue = "-", quoteCharacter = '`',
        useHeadersInDisplayName = false, ignoreLeadingAndTrailingWhitespace = true, maxCharsPerColumn = 64)
    void hasThePriceOrNone(String item, Double price) {
        assertEquals(price, Cart.priceOf(item));
    }

    @ParameterizedTest
    @CsvSource(delimiterString = "->", textBlock = """
        backpack -> 29.99
        bike-light -> 9.99
        """)
    void hasThePriceFromATextBlock(String item, double price) {
        assertEquals(price, Cart.priceOf(item));
    }

    @ParameterizedTest
    @NullSource
    @EmptySource
    @ValueSource(strings = {" ", "no-such-item"})
    void refusesAnUnknownItem(String item) {
        assertFalse(Cart.knows(item));
    }

    @ParameterizedTest
    @NullAndEmptySource
    void refusesNoCoupon(String coupon) {
        assertFalse(Cart.acceptsCoupon(coupon));
    }

    @ParameterizedTest
    @MethodSource("itemsAndPrices")
    void hasThePriceFromAMethod(String item, double price) {
        assertEquals(price, Cart.priceOf(item));
    }

    static Stream<Arguments> itemsAndPrices() {
        return Stream.of(Arguments.of("backpack", 29.99), Arguments.of("bike-light", 9.99));
    }

    @ParameterizedTest
    @EnumSource(Currency.class)
    void formatsEveryCurrency(Currency currency) {
        assertNotNull(Cart.format(10, currency));
    }

    @ParameterizedTest
    @CsvFileSource(resources = "/prices.csv")
    void hasThePriceFromAFile(String item, double price) {
        assertEquals(price, Cart.priceOf(item));
    }

    @ParameterizedTest
    @ArgumentsSource(RandomCarts.class)
    void totalIsNeverNegative(Cart cart) {
        assertFalse(cart.total() < 0);
    }

    @ParameterizedTest
    @FieldSource("ITEMS")
    void knowsEveryListedItem(String item) {
        assertNotNull(Cart.priceOf(item));
    }

    // No source: the number of cases is not known.
    @ParameterizedTest
    void hasNoSource(String item) {
        assertNotNull(item);
    }

    @TestFactory
    Stream<DynamicTest> everyItemHasAPrice() {
        return ITEMS.stream().map(item -> dynamicTest(item, () -> assertNotNull(Cart.priceOf(item))));
    }

    @TestTemplate
    void worksInEveryLocale(Cart cart) {
        assertNotNull(cart.formattedTotal());
    }
}
