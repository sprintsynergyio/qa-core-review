use shop::Cart;

#[test]
fn adds_an_item() {
    let mut cart = Cart::new();
    cart.add("backpack", 1);
    assert_eq!(cart.len(), 1);
}
