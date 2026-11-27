def test_all_prices_are_positive(api):
    for item in api.get("/items").json():
        assert item["price"] > 0  # expect: QCR-A004


def test_every_page_of_orders_is_full(api):
    page = api.get("/orders?page=1").json()
    while page["next"]:
        assert len(page["items"]) == 20  # expect: QCR-A004
        page = api.get(page["next"]).json()
