def test_order_has_the_known_shape(api, snapshot):
    response = api.get("/orders/7")
    assert response.json() == snapshot  # expect: QCR-P001
    assert dict(response.headers) == snapshot
