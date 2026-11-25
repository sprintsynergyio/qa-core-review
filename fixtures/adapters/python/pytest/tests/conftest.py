"""Fixtures shared by every test of the shop."""
import pytest
import requests

API = "https://api.example.test"


@pytest.fixture(scope="session")
def api_session():
    session = requests.Session()
    session.headers["Accept"] = "application/json"
    yield session
    session.close()


@pytest.fixture(scope="package")
def catalog(api_session):
    return api_session.get(f"{API}/catalog").json()


@pytest.fixture
def cart(api_session):
    created = api_session.post(f"{API}/carts", json={})
    cart_id = created.json()["id"]
    try:
        yield cart_id
    finally:
        api_session.delete(f"{API}/carts/{cart_id}")


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    monkeypatch.setenv("SHOP_REGION", "eu")


def assert_cart_total(response, expected):
    assert response.status_code == 200
    assert response.json()["total"] == expected
