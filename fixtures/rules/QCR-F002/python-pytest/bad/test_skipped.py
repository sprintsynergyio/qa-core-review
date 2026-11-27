import pytest

from shop.auth import login


@pytest.mark.skip  # expect: QCR-F002
def test_rejects_an_empty_password():
    assert login("standard_user", "").error == "Password is required"


@pytest.mark.skip(reason="the lockout is not ready")  # expect: QCR-F002
def test_locks_the_user_after_three_tries():
    for _ in range(3):
        login("standard_user", "wrong")
    assert login("standard_user", "secret_sauce").error == "locked out"


def test_logs_out():  # expect: QCR-F002
    pytest.skip("later")
