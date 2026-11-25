"""assertpy checks: assert_that(actual) with the check chained after it."""
from assertpy import assert_that

from shop.cart import Cart


def test_assertpy_checks(cart_with_items):
    cart = cart_with_items
    assert_that(cart.total()).is_equal_to(39.98)
    assert_that(cart.total()).is_not_equal_to(0)
    assert_that(cart.is_open).is_true()
    assert_that(cart.locked).is_false()
    assert_that(cart.owner).is_none()
    assert_that(cart.id).is_not_none()
    assert_that(cart.items).contains("backpack")
    assert_that(cart.items).does_not_contain("coupon")
    assert_that(cart).is_instance_of(Cart)
    assert_that(cart.items).is_length(2)
    assert_that(Cart().items).is_empty()
    assert_that(cart.items).is_not_empty()
    assert_that(cart.total()).is_greater_than(0)
    assert_that(cart.total()).is_greater_than_or_equal_to(39.98)
    assert_that(cart.total()).is_less_than(100)
    assert_that(cart.total()).is_less_than_or_equal_to(39.98)
    assert_that(cart.add).raises(ValueError).when_called_with(None)
    # Two checks on one chain, and a chain that is never finished.
    assert_that(cart.items).is_not_empty().contains("bike-light")
    assert_that(cart.total())
