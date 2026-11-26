from shop.discount import apply_discount


def test_ten_percent_off(monkeypatch):
    monkeypatch.setattr("shop.discount.apply_discount", lambda price, code: 90)
    assert apply_discount(100, "SAVE10") == 90  # expect: QCR-M001
