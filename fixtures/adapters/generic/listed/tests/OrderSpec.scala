// qa-core-review-disable QCR-X003 -- reviewed by hand until Scala has patterns
class OrderSpec extends AnyFunSuite {
  test("starts as new") {
    assert(new Order("backpack").status == "new")
  }
}
