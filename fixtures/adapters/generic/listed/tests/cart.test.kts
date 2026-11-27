val cart = Cart()
cart.add("backpack", 1)
check(cart.size == 1) { "expected one item" }
