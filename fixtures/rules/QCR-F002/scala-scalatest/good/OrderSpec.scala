import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers

class OrderSpec extends AnyFunSuite with Matchers {
  test("can ignore a warning") {
    val order = new OrderService().place("backpack", 2)
    order.ignore("stock is low")
    assert(order.warnings.isEmpty)
  }
}
