#!/usr/bin/env bats

setup() {
  export CART_FILE="$BATS_TEST_TMPDIR/cart"
}

@test "adds an item" {
  run ./cart.sh add backpack 1
  [ "$status" -eq 0 ]
  [ "$output" = "1 item" ]
}

@test "waits for the sync" {
  ./cart.sh sync &
  sleep 5 # the sync has no ready signal
  ./cart.sh status
}
