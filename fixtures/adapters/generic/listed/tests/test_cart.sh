#!/bin/sh
. ./cart.sh

test_adds_an_item() {
  cart_add backpack 1
  [ "$(cart_size)" -eq 1 ] || exit 1
}

test_adds_an_item
