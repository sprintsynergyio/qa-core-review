const std = @import("std");

test "adds an item" {
    var cart = Cart.init();
    cart.add("backpack", 1);
    try std.testing.expectEqual(@as(usize, 1), cart.len());
}

test "clears the cart" {
    var cart = Cart.init();
    cart.clear();
}
