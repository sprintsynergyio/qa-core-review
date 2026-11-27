test_that("adds an item", {
  cart <- add_item(new_cart(), "backpack", 1)
  expect_equal(length(cart$items), 1)
})
