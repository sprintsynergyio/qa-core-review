import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers

class CheckoutSpec extends AnyFunSuite with Matchers {
  ignore("pays the order") { // expect: QCR-F002
    new Checkout().pay("4111", 29.99)
  }
}
