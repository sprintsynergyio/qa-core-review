import sqlite3

from shop.orders import export_orders, load_orders


def test_exports_the_orders(tmp_path):
    with open(tmp_path / "orders.csv", "w") as target:
        export_orders(target)
        assert target.tell() > 0


def test_loads_the_orders():
    connection = sqlite3.connect("orders.db")
    try:
        assert len(load_orders(connection)) == 3
    finally:
        connection.close()
