import requests

BASE_URL = "https://api.example.test"


def test_lists_orders():
    response = requests.get(f"{BASE_URL}/orders")
    assert response.status_code == 200
    assert len(response.json()) == 3


def test_reads_one_order():
    response = requests.get(f"{BASE_URL}/orders/7")
    response.raise_for_status()
    assert response.json()["id"] == 7
