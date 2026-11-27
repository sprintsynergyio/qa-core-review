#include <gtest/gtest.h>
#include "cart.h"

TEST(CartTest, AddsAnItem) {
  Cart cart;
  cart.add("backpack", 1);
  EXPECT_EQ(cart.size(), 1);
}
