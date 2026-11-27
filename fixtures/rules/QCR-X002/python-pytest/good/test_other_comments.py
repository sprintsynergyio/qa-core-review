from shop.jobs import run_import  # noqa: F401

# A comment for another tool is not a suppression for this one.
# pylint: disable=missing-function-docstring


def test_import_counts_the_rows():
    # The word disable in an ordinary comment means nothing here.
    job = run_import("orders.csv")
    assert job.rows == 3  # type: ignore[attr-defined]
