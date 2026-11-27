import org.scalatest.funsuite.AnyFunSuite // expect: QCR-X003

class CartSpec extends AnyFunSuite {
  test("adds an item") {
    val cart = new Cart()
    cart.add("backpack", 1)
  }
}
