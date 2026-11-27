use shop::OrderService;

#[test]
fn ships_an_order() {
    let order = OrderService::new().place("backpack", 2);
    // thread::sleep(Duration::from_millis(500)) was here before the status had a channel
    order.status_changes().recv().unwrap();
    assert_eq!(order.status(), "shipped");
}
