import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers

class CheckoutSpec extends AnyFunSuite with Matchers {
  test("pays the order") {
    val checkout = new Checkout()
    checkout.start("4111", 29.99)
    for (_ <- 1 to 3) {
      Thread.sleep(250) // expect: QCR-W001
    }
    assert(checkout.status == "paid")
  }
}
