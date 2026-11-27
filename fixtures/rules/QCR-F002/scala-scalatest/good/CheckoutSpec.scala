import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers

class CheckoutSpec extends AnyFunSuite with Matchers {
  // ignore("pays the order") was switched back on when the sandbox came back
  test("pays the order") {
    assert(new Checkout().pay("4111", 29.99).status == "paid")
  }
}
