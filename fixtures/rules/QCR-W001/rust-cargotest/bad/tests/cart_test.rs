use shop::Cart;
use std::thread::sleep;
use std::time::Duration;

#[test]
fn syncs_the_cart() {
    let cart = Cart::new();
    cart.sync();
    sleep(Duration::from_secs(2)); // expect: QCR-W001
    assert!(cart.synced());
}
