def test_creates_an_order(api):
    response = api.post("https://api.example.test/orders", json={"item": "backpack"})
    assert response.status_code == 201
    api.delete(f"https://api.example.test/orders/{response.json()['id']}")
