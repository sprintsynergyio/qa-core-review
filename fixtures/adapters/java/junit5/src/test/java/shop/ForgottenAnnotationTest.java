package shop;

import static org.junit.jupiter.api.Assertions.assertEquals;

// No method has @Test, so JUnit runs nothing here. The file is still a test file by its name
// and its methods, and the review says that no test was found in it.
class ForgottenAnnotationTest {
    void addsAnItem() {
        assertEquals(1, new Cart().add("backpack").size());
    }

    void startsEmpty() {
        assertEquals(0, new Cart().size());
    }
}
