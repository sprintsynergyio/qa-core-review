import Quick
import Nimble

final class CartSpec: QuickSpec {
    override class func spec() {
        it("adds an item") {
            let cart = Cart()
            cart.add("backpack", quantity: 1)
            expect(cart.count).to(equal(1))
        }
    }
}
