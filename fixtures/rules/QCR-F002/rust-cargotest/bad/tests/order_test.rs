use shop::OrderService;

#[ignore] // expect: QCR-F002
#[test]
fn ships_an_order() {
    let order = OrderService::new().place("backpack", 2);
    assert_eq!(order.ship().status(), "shipped");
}
