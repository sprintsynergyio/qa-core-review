import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers

class OrderSpec extends AnyFunSuite with Matchers {
  test("ships an order") {
    val order = new OrderService().place("backpack", 2)
    java.lang.Thread.sleep(500) // expect: QCR-W001
    order.status shouldBe "shipped"
  }

  test("cancels an order") { val order = new OrderService().place("backpack", 2); order.cancel(); Thread.sleep(100); assert(order.cancelled) } // expect: QCR-W001
}
