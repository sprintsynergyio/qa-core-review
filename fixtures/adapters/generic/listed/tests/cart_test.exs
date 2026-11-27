defmodule Shop.CartTest do
  use ExUnit.Case

  test "adds an item" do
    cart = Shop.Cart.add(%Shop.Cart{}, "backpack", 1)
    assert length(cart.items) == 1
  end
end
