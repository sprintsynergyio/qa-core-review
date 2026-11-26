"""PyHamcrest matchers. The assertpy checks are in test_assertpy.py."""
from hamcrest import (
    assert_that, calling, close_to, contains_string, empty, equal_to, greater_than, greater_than_or_equal_to, has_item, has_items, has_length,
    instance_of, is_, is_not, less_than, less_than_or_equal_to, none, not_, not_none, raises,
)

from shop.cart import Cart


def test_hamcrest_matchers(cart_with_items):
    cart = cart_with_items
    assert_that(cart.total(), equal_to(39.98))
    assert_that(cart.total(), is_(equal_to(39.98)))
    assert_that(cart.total(), is_(39.98))
    assert_that(cart.total(), is_not(equal_to(0)))
    assert_that(cart.total(), not_(0))
    assert_that(cart.tax(), close_to(7.6, 0.01))
    assert_that(cart.owner, none())
    assert_that(cart.id, not_none())
    assert_that(cart.items, has_length(2))
    assert_that(Cart().items, empty())
    assert_that(cart.label(), contains_string("backpack"))
    assert_that(cart.items, has_item("backpack"))
    assert_that(cart.items, has_items("backpack", "bike-light"))
    assert_that(cart, instance_of(Cart))
    assert_that(cart.total(), greater_than(0))
    assert_that(cart.total(), greater_than_or_equal_to(39.98))
    assert_that(cart.total(), less_than(100))
    assert_that(cart.total(), less_than_or_equal_to(39.98))
    assert_that(calling(cart.add).with_args(None), raises(ValueError))
    assert_that(cart.is_open)
