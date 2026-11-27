import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers

class OrderSpec extends AnyFunSuite with Matchers {
  test("places an order") { assert(new OrderService().place("backpack", 2).status == "new") }

  test("rejects an unknown item") {
    intercept[IllegalArgumentException] {
      new OrderService().place("unknown", 1)
    }
  }
}
