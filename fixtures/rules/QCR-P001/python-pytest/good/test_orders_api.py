def test_order_has_the_known_shape(api, snapshot):
    response = api.get("/orders/7")
    assert response.status_code == 200
    assert response.json()["status"] == "placed"
    assert response.json() == snapshot
