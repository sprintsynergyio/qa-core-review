package shop;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import org.junit.jupiter.api.Test;
import org.opentest4j.AssertionFailedError;
import org.opentest4j.MultipleFailuresError;

class TryCatchTest {
    private final Cart cart = new Cart("ana");

    @Test
    void swallowsAFailedCheck() {
        try {
            assertEquals(1, cart.size());
        } catch (Throwable ignored) {
            // nothing
        }
    }

    @Test
    void swallowsEveryKindOfFailure() {
        try {
            assertEquals(1, cart.size());
        } catch (AssertionError e) {
            System.out.println(e.getMessage());
        }
        try {
            assertEquals(1, cart.size());
        } catch (Error e) {
            cart.clear();
        }
        try {
            assertEquals(1, cart.size());
        } catch (AssertionFailedError e) {
            cart.clear();
        }
        try {
            assertEquals("ana", cart.owner());
        } catch (MultipleFailuresError | IllegalStateException e) {
            cart.clear();
        }
    }

    @Test
    void doesNotCatchAFailedCheck() {
        try {
            cart.pay();
            assertTrue(cart.isPaid());
        } catch (Exception e) {
            cart.clear();
        }
    }

    @Test
    void expectsTheError() {
        try {
            cart.pay();
            fail("an empty cart cannot be paid");
        } catch (IllegalStateException e) {
            assertEquals("the cart is empty", e.getMessage());
        }
    }

    @Test
    void passesTheFailureOn() {
        try {
            assertEquals(1, cart.size());
        } catch (AssertionError e) {
            throw new IllegalStateException("the cart is wrong", e);
        }
        try {
            assertEquals(1, cart.size());
        } catch (IllegalStateException e) {
            cart.clear();
        } catch (Throwable t) {
            fail("the cart is wrong", t);
        }
    }

    @Test
    void cleansUpAfterTheCheck() {
        try {
            assertEquals(0, cart.size());
        } finally {
            cart.clear();
        }
        try (Session session = cart.open()) {
            assertTrue(session.isOpen());
        }
    }
}
