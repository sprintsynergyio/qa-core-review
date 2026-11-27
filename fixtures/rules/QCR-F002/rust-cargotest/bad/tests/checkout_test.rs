use shop::Checkout;

#[tokio::test] // expect: QCR-F002
#[ignore = "needs the payment sandbox"]
async fn pays_the_order() {
    let receipt = Checkout::new().pay("4111", 29.99).await;
    assert!(receipt.is_ok());
}
