use shop::Checkout;
use std::time::Duration;

#[tokio::test]
async fn pays_the_order() {
    let checkout = Checkout::start("4111", 29.99);
    tokio::time::sleep(Duration::from_millis(250)).await; // expect: QCR-W001
    assert_eq!(checkout.status().await, "paid");
}
