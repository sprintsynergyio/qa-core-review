import sqlite3

from shop.orders import export_orders, load_orders


def test_exports_the_orders():
    target = open("orders.csv", "w")  # expect: QCR-C001
    export_orders(target)
    assert target.tell() > 0


def test_loads_the_orders():
    connection = sqlite3.connect("orders.db")  # expect: QCR-C001
    assert len(load_orders(connection)) == 3
