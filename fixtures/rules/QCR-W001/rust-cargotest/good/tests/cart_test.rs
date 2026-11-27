use shop::Cart;

#[test]
fn syncs_the_cart() {
    let cart = Cart::new();
    cart.sync().wait();
    assert!(cart.synced());
}
