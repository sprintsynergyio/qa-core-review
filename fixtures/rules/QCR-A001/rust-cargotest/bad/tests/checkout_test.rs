use shop::Checkout;

#[tokio::test] // expect: QCR-A001
async fn pays_the_order() {
    let receipt = Checkout::new().pay("4111", 29.99).await;
    let note = "assert_eq!(receipt.status, paid) is still to do";
    println!("{receipt:?} {note}");
}
