use shop::OrderService;
use std::{thread, time::Duration};

#[test]
fn ships_an_order() {
    let order = OrderService::new().place("backpack", 2);
    thread::sleep(Duration::from_millis(500)); // expect: QCR-W001
    assert_eq!(order.status(), "shipped");
}
