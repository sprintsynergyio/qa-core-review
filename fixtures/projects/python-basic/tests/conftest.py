import pytest

from shop.cart import Cart


@pytest.fixture
def cart():
    return Cart()
