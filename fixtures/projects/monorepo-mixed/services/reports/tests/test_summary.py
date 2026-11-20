from reports.summary import summarize


def test_summarize_counts_and_adds(amounts):
    assert summarize(amounts) == {"count": 2, "total": 15}
