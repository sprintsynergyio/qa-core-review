#include <gtest/gtest.h>
#include "order.h"

TEST(OrderTest, StartsAsNew) {
  Order order("backpack");
  EXPECT_EQ(order.status(), "new");
}
