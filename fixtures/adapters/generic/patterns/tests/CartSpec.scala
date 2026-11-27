import org.scalatest.funsuite.AnyFunSuite

class CartSpec extends AnyFunSuite {
  // The title says "should", and the body checks nothing.
  test("should add an item") {
    val cart = new Cart()
    cart.add("backpack", 1)
  }

  test("totals the cart") {
    val cart = new Cart()
    cart.add("backpack", 1)
    Thread.sleep(500)
    assert(cart.total == 29.99)
  }

  ignore("applies a coupon") {
    val cart = new Cart().withCoupon("SAVE10")
    cart.total shouldBe 26.99
  }

  test("is empty at first") { assert(new Cart().isEmpty) }

  test("prints the cart") { println(new Cart()) }

  test("keeps the items in a map") {
    val items = Map("backpack" -> 1)
    val text = "a { brace } in a string"
    /* assert(false) in a comment is not an assertion */
    items.foreach { case (name, quantity) =>
      println(s"$name: $quantity")
    }
  }
}
