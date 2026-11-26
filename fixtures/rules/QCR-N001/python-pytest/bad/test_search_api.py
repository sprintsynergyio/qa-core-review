import requests

BASE_URL = "https://api.example.test"


def test_search_finds_the_backpack():  # expect: QCR-N001
    response = requests.get(f"{BASE_URL}/search", params={"q": "backpack"})
    assert response.status_code == 200
    assert response.json()[0]["name"] == "Sauce Labs Backpack"


def test_search_sorts_by_price():
    response = requests.get(f"{BASE_URL}/search", params={"q": "sauce", "sort": "price"})
    assert response.status_code == 200
