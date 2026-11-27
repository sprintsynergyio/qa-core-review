use shop::OrderService;

#[test]
fn places_an_order() {
    let order = OrderService::new().place("backpack", 2);
    assert_ne!(order.id(), 0);
}

#[test]
fn fails_on_an_unknown_item() {
    match OrderService::new().try_place("unknown", 1) {
        Ok(order) => panic!("an unknown item was ordered: {order:?}"),
        Err(_) => {}
    }
}
