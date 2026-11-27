#!/usr/bin/env bats

@test "adds an item" {
  run ./cart.sh add backpack 1
  [ "$status" -eq 0 ]
  [ "$output" = "1 item" ]
}
