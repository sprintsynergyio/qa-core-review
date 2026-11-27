use shop::Cart;

#[test] // expect: QCR-F002
#[ignore]
fn applies_a_coupon() {
    let cart = Cart::new().with_coupon("SAVE10");
    assert_eq!(cart.total(), 26.99);
}

#[test]
fn adds_an_item() {
    assert_eq!(Cart::new().add("backpack", 1).len(), 1);
}
