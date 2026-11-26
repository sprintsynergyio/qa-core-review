import os

from shop.config import api_url


def test_uses_the_staging_api():
    os.environ["API_URL"] = "https://api.example.test"  # expect: QCR-C001
    assert api_url() == "https://api.example.test"
