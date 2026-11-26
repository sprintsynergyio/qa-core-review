import pytest

from shop.auth import login


@pytest.mark.parametrize("user", ["standard_user", "performance_glitch_user"])
def test_login_works(user):
    session = login(user, "secret_sauce")
    assert session.ok
    assert session.user == user


def test_login_keeps_the_session_for_a_day():
    session = login("standard_user", "secret_sauce")
    assert session.ok
    assert session.expires_in == 86400
