import sys

import pytest

from shop.auth import login


def test_rejects_an_empty_password():
    assert login("standard_user", "").error == "Password is required"


@pytest.mark.skipif(sys.platform == "win32", reason="File picker is not supported on Windows CI")
def test_uploads_an_avatar():
    assert login("standard_user", "secret_sauce").upload("avatar.png").ok


def test_logs_in_with_a_passkey():
    if not sys.platform.startswith("linux"):
        pytest.skip("passkeys are tested on Linux only")
    assert login("standard_user", passkey=True).ok
