"""A helper class. It is not a test class, and its methods are not tests."""


class CartPage:
    def __init__(self, session, base_url):
        self.session = session
        self.base_url = base_url

    def test_connection(self):
        return self.session.get(f"{self.base_url}/health").ok

    def add(self, cart_id, sku, quantity=1):
        return self.session.post(f"{self.base_url}/carts/{cart_id}/items", json={"sku": sku, "quantity": quantity})
