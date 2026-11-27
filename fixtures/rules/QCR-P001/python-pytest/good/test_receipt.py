from shop.receipt import format_receipt


def test_formats_the_receipt(snapshot):
    receipt = format_receipt(items=["backpack"], tax=2.40)
    assert receipt.endswith("Total $32.39")
    snapshot.assert_match(receipt, "receipt.txt")
