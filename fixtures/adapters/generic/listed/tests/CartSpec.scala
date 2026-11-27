import org.scalatest.funsuite.AnyFunSuite

class CartSpec extends AnyFunSuite {
  test("adds an item") {
    val cart = new Cart()
    cart.add("backpack", 1)
    assert(cart.size == 1)
  }
}
