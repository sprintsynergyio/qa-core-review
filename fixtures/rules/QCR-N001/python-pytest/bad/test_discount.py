from shop.discount import apply_discount


class TestApplyDiscount:  # expect: QCR-N001
    def test_ten_percent(self):
        assert apply_discount(100, "SAVE10") == 90

    def test_twenty_percent(self):
        assert apply_discount(100, "SAVE20") == 80
