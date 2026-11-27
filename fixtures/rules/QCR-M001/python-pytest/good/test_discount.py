from shop.discount import apply_discount


def test_ten_percent_off(monkeypatch):
    monkeypatch.setattr("shop.discount.load_codes", lambda: {"SAVE10": 0.10})
    assert apply_discount(100, "SAVE10") == 90
