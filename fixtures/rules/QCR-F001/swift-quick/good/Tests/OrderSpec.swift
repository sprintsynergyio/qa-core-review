import Quick
import Nimble

final class OrderSpec: QuickSpec {
    override class func spec() {
        describe("an order") {
            it("is a good fit(for the truck)") { expect(Order("backpack").fits(Truck())).to(beTrue()) }
        }
    }
}
