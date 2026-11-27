import XCTest

final class CartTests: XCTestCase {
    func testAddsAnItem() {
        let cart = Cart()
        cart.add("backpack", quantity: 1)
        XCTAssertEqual(cart.count, 1)
    }
}
