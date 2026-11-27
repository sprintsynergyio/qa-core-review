from shop.cart import Cart


class TestCart:
    def test_removes_an_item(self):
        cart = Cart()
        cart.add("backpack")
        cart.remove("backpack")
        assert cart.items == []

    def test_cart_is_empty_after_removing(self):  # expect: QCR-D001
        cart = Cart()
        cart.add("backpack")
        cart.remove("backpack")
        assert cart.items == []

    def test_rejects_a_missing_item(self):
        cart = Cart()
        cart.add("backpack")
        assert cart.remove("onesie") is False
