import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers

class CartSpec extends AnyFunSuite with Matchers {
  test("should add an item") { // expect: QCR-A001
    val cart = new Cart()
    cart.add("backpack", 1)
  }

  test("empties the cart") { // expect: QCR-A001
    val cart = new Cart()
    cart.add("backpack", 1)
    cart.clear()
    println(cart.size)
  }
}
