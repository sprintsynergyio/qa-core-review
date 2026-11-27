use shop::Cart; // expect: QCR-X003

#[test]
#[ignore]
fn adds_an_item() {
    let mut cart = Cart::new();
    cart.add("backpack", 1);
}
