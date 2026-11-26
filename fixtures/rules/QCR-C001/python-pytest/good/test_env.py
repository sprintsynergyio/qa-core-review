from shop.config import api_url


def test_uses_the_staging_api(monkeypatch):
    # pytest puts the variable back after the test.
    monkeypatch.setenv("API_URL", "https://api.example.test")
    assert api_url() == "https://api.example.test"
