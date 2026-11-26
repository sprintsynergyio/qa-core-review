from shop.cart import Cart


class TestCart:
    def test_removes_an_item(self):
        cart = Cart()
        cart.add("backpack")
        cart.add("onesie")
        cart.remove("backpack")
        assert cart.items == ["onesie"]

    def test_clear_removes_every_item(self):
        cart = Cart()
        cart.add("backpack")
        cart.clear()
        assert cart.items == []

    # One-line tests are too short to compare, so these two are not reported.
    def test_new_cart_is_empty(self):
        assert Cart().items == []

    def test_cart_starts_without_items(self):
        assert Cart().items == []
