defmodule Shop.CartTest do
  use ExUnit.Case

  describe "add/3" do
    test "adds an item", %{cart: cart} do
      cart = Shop.Cart.add(cart, "backpack", 1)
      assert length(cart.items) == 1
    end

    @tag :skip
    test "merges two carts" do
      merged = Shop.Cart.merge(%Shop.Cart{}, %Shop.Cart{})
      Process.sleep(200)
      refute merged.items == nil
    end

    @tag :only
    test "prints the cart" do
      IO.inspect(%Shop.Cart{})
    end

    test "is not written yet"
  end

  test "keeps the totals in a map" do
    totals = %{backpack: 29.99}
    IO.inspect(totals)
  end

  defp helper(cart) do
    assert cart
  end
end
