use shop::Checkout;

#[test]
fn names_the_attribute() {
    let hint = Checkout::skip_hint();
    assert_eq!(hint, "mark slow tests with #[ignore]");
}
