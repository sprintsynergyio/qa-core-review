class CartSpec extends AnyFlatSpec {
  "A cart" should "start empty" in {
    assert(new Cart().items.isEmpty)
  }
}
