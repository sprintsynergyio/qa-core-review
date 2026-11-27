#include <assert.h>
#include "cart.h"

void test_adds_an_item(void) {
  struct cart c = cart_new();
  cart_add(&c, "backpack", 1);
  assert(c.size == 1);
}
