import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class CartTest {
    @Test
    fun `adds an item`() {
        val cart = Cart()
        cart.add("backpack", 1)
        assertEquals(1, cart.size)
    }
}
