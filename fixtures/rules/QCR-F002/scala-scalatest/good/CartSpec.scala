import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers

class CartSpec extends AnyFunSuite with Matchers {
  test("applies a coupon") {
    val cart = new Cart().withCoupon("SAVE10")
    cart.total shouldBe 26.99
  }
}
