import requests

BASE_URL = "https://api.example.test"


def test_search_finds_the_backpack():
    response = requests.get(f"{BASE_URL}/search", params={"q": "backpack"})
    response.raise_for_status()
    assert [item["name"] for item in response.json()] == ["Sauce Labs Backpack"]


def test_search_needs_a_query():
    response = requests.get(f"{BASE_URL}/search")
    assert response.status_code == 400
