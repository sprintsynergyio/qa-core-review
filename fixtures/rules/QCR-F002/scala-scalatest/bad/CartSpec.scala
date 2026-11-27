import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers

class CartSpec extends AnyFunSuite with Matchers {
  ignore("applies a coupon") { // expect: QCR-F002
    val cart = new Cart().withCoupon("SAVE10")
    cart.total shouldBe 26.99
  }

  test("adds an item") {
    assert(new Cart().add("backpack", 1).size == 1)
  }
}
