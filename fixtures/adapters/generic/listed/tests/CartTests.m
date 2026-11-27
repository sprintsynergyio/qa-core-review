#import <XCTest/XCTest.h>
#import "Cart.h"

@interface CartTests : XCTestCase
@end

@implementation CartTests
- (void)testAddsAnItem {
    Cart *cart = [Cart new];
    [cart add:@"backpack" quantity:1];
    XCTAssertEqual(cart.count, 1);
}
@end
