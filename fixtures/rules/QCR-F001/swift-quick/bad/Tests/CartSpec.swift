import Quick
import Nimble

final class CartSpec: QuickSpec {
    override class func spec() {
        fit("adds an item") { // expect: QCR-F001
            let cart = Cart()
            cart.add("backpack", quantity: 1)
            expect(cart.count).to(equal(1))
        }

        it("empties the cart") {
            expect(Cart().cleared().count).to(equal(0))
        }
    }
}
