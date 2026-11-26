from shop.auth import login


def test_all_prices_are_positive(api):
    items = api.get("/items").json()
    assert len(items) > 0
    for item in items:
        assert item["price"] > 0


def test_known_users_can_log_in():
    # A loop over a list that is written out always runs.
    for user in ["standard_user", "performance_glitch_user"]:
        assert login(user).ok
