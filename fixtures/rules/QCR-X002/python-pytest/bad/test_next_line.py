import time

from shop.jobs import run_export


def test_export_finishes():
    job = run_export()
    # qa-core-review-disable-next-line QCR-W001
    time.sleep(1)
    assert job.done
