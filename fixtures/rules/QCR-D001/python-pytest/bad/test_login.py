from shop.auth import login


def test_login_works():
    session = login("standard_user", "secret_sauce")
    assert session.ok
    assert session.user == "standard_user"


def test_login_works_for_standard_user():  # expect: QCR-D001
    session = login("standard_user", "secret_sauce")
    assert session.ok
    assert session.user == "standard_user"
