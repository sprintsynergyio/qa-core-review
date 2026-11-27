from shop.render import render_cart


def test_renders_cart(snapshot):
    html = render_cart([{"name": "Backpack", "price": 29.99}])
    # The values that matter are checked by name. The snapshot guards the rest.
    assert "Backpack" in html
    assert "$29.99" in html
    assert html == snapshot
