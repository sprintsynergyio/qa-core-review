import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers

class CartSpec extends AnyFunSuite with Matchers {
  test("syncs the cart") {
    val cart = new Cart()
    cart.sync()
    Thread.sleep(2000) // expect: QCR-W001
    assert(cart.synced)
  }
}
