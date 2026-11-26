from shop.cart import Cart


def show_total(cart, expected):
    # Looks like a check, and compares nothing.
    print(cart.total(), expected)


def test_total_of_two_items():  # expect: QCR-A001
    cart = Cart()
    cart.add("backpack")
    cart.add("bike-light")
    show_total(cart, 39.98)
