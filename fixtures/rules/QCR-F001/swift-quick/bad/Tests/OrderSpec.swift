import Quick
import Nimble

final class OrderSpec: QuickSpec {
    override class func spec() {
        describe("an order") {
            fit("ships") { expect(Order("backpack").ship().status).to(equal("shipped")) } // expect: QCR-F001
        }
    }
}
