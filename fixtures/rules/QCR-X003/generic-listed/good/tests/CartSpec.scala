import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers

class CartSpec extends AnyFunSuite with Matchers {
  test("adds an item") {
    val cart = new Cart()
    cart.add("backpack", 1)
    assert(cart.size == 1)
  }
}
