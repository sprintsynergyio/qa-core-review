import Quick
import Nimble

final class CheckoutSpec: QuickSpec {
    override class func spec() {
        context("with a valid card") {
            // fit("pays the order") was used while the sandbox was down
            it("pays the order") {
                expect(Checkout().pay(29.99).status).to(equal("paid"))
            }
        }
    }
}
