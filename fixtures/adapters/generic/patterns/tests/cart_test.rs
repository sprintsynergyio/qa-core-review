use shop::Cart;
use std::thread::sleep;
use std::time::Duration;

fn cart_with<'a>(name: &'a str) -> Cart {
    let mut cart = Cart::new();
    cart.add(name, 1);
    cart
}

#[test]
fn adds_an_item() {
    let cart = cart_with("backpack");
    assert_eq!(cart.len(), 1);
}

#[test]
fn clears_the_cart() {
    let mut cart = cart_with("backpack");
    cart.clear();
    println!("{}", cart.len());
}

#[test]
#[ignore]
fn syncs_with_the_server() {
    let cart = cart_with("backpack");
    sleep(Duration::from_secs(2));
    assert!(cart.sync().is_ok());
}

#[ignore = "needs the payment sandbox"]
#[tokio::test(flavor = "multi_thread")]
async fn pays_the_order() {
    let receipt = cart_with("backpack").pay().await;
    assert!(receipt.is_ok());
}

#[test]
fn rejects_a_negative_quantity() { assert!(Cart::new().try_add("backpack", -1).is_err()); }
