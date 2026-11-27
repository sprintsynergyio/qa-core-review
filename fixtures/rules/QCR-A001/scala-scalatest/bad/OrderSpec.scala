import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers

class OrderSpec extends AnyFunSuite with Matchers {
  test("places an order") { println(new OrderService().place("backpack", 2)) } // expect: QCR-A001

  test("ships an order") { // expect: QCR-A001
    val orders = new OrderService()
    val order = orders.place("backpack", 2)
    // assert(order.status == "shipped")
    orders.ship(order)
  }
}
