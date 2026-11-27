use shop::OrderService;

// #[ignore] was removed when the shipping stub came back
#[test]
fn ships_an_order() {
    let order = OrderService::new().place("backpack", 2);
    assert_eq!(order.ship().status(), "shipped");
}
