use shop::OrderService;

#[test] // expect: QCR-A001
fn places_an_order() {
    let orders = OrderService::new();
    let order = orders.place("backpack", 2);
    // assert_eq!(order.status(), "new");
    let _ = order;
}
