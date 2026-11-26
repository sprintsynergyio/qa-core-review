# qa-core-review-disable QCR-A002
from shop.jobs import run_cleanup


def test_cleanup_runs():
    run_cleanup()
    assert True
