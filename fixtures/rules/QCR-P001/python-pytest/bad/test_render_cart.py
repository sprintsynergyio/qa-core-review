from shop.render import render_cart


def test_renders_cart(snapshot):
    assert render_cart([{"name": "Backpack", "price": 29.99}]) == snapshot  # expect: QCR-P001
