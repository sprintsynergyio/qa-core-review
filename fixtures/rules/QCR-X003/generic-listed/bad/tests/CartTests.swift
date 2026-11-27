import XCTest // expect: QCR-X003

final class CartTests: XCTestCase {
    func testAddsAnItem() {
        let cart = Cart()
        sleep(2)
        cart.add("backpack", quantity: 1)
    }
}
