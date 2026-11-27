use shop::Cart;

#[test]
fn applies_a_coupon() {
    let cart = Cart::new().with_coupon("SAVE10");
    assert_eq!(cart.total(), 26.99);
}
