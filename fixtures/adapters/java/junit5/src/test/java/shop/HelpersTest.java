package shop;

import static io.qameta.allure.Allure.step;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.stream.Stream;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;
import shop.support.Checks;

class HelpersTest {
    private final Cart cart = new Cart("ana");

    @Test
    void usesAHelperOfTheClass() {
        cart.add("apple", 2);
        checkTotal(cart, 1.98);
    }

    @Test
    void usesAHelperOfAnotherClass() {
        cart.add("apple", 2);
        Checks.cartHasItems(cart, 2);
        new Checks().ownerIs(cart, "ana");
    }

    @Test
    void usesAHelperForEachItem() {
        cart.items().forEach(this::checkItem);
    }

    @Test
    void namesTheCheck() {
        assertCart(cart);
    }

    @Test
    void callsNoHelper() {
        cart.add("apple", 2);
        printCart(cart);
    }

    @Test
    void checksInsideAStep() {
        step("the cart starts empty", () -> assertEquals(0, cart.size()));
    }

    @TestFactory
    Stream<DynamicTest> checksEachName() {
        return Stream.of("apple", "pear").map(name -> DynamicTest.dynamicTest(name, () -> assertNotNull(cart.find(name))));
    }

    private void checkTotal(Cart cart, double expected) {
        assertEquals(expected, cart.total(), 0.001);
    }

    private void checkItem(Item item) {
        assertNotNull(item.name());
    }

    private void printCart(Cart cart) {
        System.out.println(cart);
    }
}
