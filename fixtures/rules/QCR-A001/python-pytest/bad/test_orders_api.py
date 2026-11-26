import requests

BASE_URL = "https://api.example.test"


def test_lists_orders():  # expect: QCR-A001
    response = requests.get(f"{BASE_URL}/orders")
    orders = response.json()
    print(len(orders))


def test_reads_one_order():  # expect: QCR-A001
    requests.get(f"{BASE_URL}/orders/7").json()
