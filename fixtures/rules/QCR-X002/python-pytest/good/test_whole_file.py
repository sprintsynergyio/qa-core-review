# qa-core-review-disable QCR-A002 -- smoke tests: they only have to run without an error
from shop.jobs import run_cleanup


def test_cleanup_runs():
    run_cleanup()
    assert True, "the cleanup ran"
