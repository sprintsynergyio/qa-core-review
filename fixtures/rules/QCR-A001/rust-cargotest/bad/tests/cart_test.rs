use shop::Cart;

#[test] // expect: QCR-A001
fn adds_an_item() {
    let mut cart = Cart::new();
    cart.add("backpack", 1);
    println!("{}", cart.len());
}

#[test] // expect: QCR-A001
fn clears_the_cart() {
    let mut cart = Cart::new();
    cart.clear();
}
