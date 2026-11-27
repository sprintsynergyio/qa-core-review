use shop::Checkout;

#[tokio::test]
async fn explains_the_timeout() {
    let message = Checkout::timeout_message();
    assert_eq!(message, "do not call sleep(1) here");
}
