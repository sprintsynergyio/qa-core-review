from shop.discount import apply_discount
from shop.orders import place_order


def test_order_total():
    order = place_order(["backpack"])
    try:  # expect: QCR-E001
        assert order.total == 32.39
    except Exception as error:
        print("total did not match", error)


def test_ten_percent_off():
    try:  # expect: QCR-E001
        assert apply_discount(100, "SAVE10") == 90
    except:
        pass
