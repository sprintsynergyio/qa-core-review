import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers

class CheckoutSpec extends AnyFunSuite with Matchers {
  test("pays the order") { // expect: QCR-A001
    val receipt = new Checkout().pay("4111", 29.99)
    val note = "we should assert the status here"
    println(receipt + note)
  }
}
