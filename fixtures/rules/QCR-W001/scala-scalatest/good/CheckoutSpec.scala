import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers

class CheckoutSpec extends AnyFunSuite with Matchers {
  test("explains the timeout") {
    val message = new Checkout().timeoutMessage
    assert(message == "Do not call Thread.sleep(1000) here")
  }
}
