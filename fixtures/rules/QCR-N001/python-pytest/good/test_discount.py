import pytest

from shop.discount import apply_discount


class TestApplyDiscount:
    def test_ten_percent(self):
        assert apply_discount(100, "SAVE10") == 90

    def test_unknown_code(self):
        with pytest.raises(ValueError, match="Invalid code"):
            apply_discount(100, "NOPE")
