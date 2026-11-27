import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers

class CheckoutSpec extends AnyFunSuite with Matchers {
  test("pays the order") {
    val receipt = new Checkout().pay("4111", 29.99)
    receipt.status should be ("paid")
  }
}
