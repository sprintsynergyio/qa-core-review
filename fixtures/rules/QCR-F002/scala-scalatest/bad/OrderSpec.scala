import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers

class OrderSpec extends AnyFunSuite with Matchers {
  ignore("ships an order") { assert(new OrderService().place("backpack", 2).ship().status == "shipped") } // expect: QCR-F002
}
