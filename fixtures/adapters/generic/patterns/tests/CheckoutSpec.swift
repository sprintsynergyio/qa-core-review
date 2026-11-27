import Quick
import Nimble

final class CheckoutSpec: QuickSpec {
    override class func spec() {
        describe("checkout") {
            it("pays the order") {
                expect(Checkout().pay(29.99).status).to(equal("paid"))
            }

            fit("rejects an expired card") {
                expect(Checkout().pay(29.99, card: "expired").status).to(equal("declined"))
            }

            xit("sends a receipt") {
                Checkout().pay(29.99)
            }
        }
    }
}
