import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers

class OrderSpec extends AnyFunSuite with Matchers {
  test("ships an order") {
    val order = new OrderService().place("backpack", 2)
    // Thread.sleep(500) was here before the status had an event
    order.awaitStatus("shipped")
    order.status shouldBe "shipped"
  }
}
