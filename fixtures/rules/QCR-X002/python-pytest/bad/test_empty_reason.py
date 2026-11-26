import time

from shop.jobs import run_import


def test_import_finishes():
    job = run_import("orders.csv")
    # qa-core-review-disable-next-line QCR-W001 --
    time.sleep(2)
    assert job.rows == 3
