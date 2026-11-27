import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers

class CartSpec extends AnyFunSuite with Matchers {
  test("syncs the cart") {
    val cart = new Cart()
    cart.sync()
    eventually { assert(cart.synced) }
  }
}
