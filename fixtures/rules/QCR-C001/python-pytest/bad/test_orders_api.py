def test_creates_an_order(api):
    response = api.post("https://api.example.test/orders", json={"item": "backpack"})  # expect: QCR-C001
    assert response.status_code == 201
