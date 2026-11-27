defmodule Shop.CartCase do
  use ExUnit.CaseTemplate

  setup do
    {:ok, cart: %Shop.Cart{}}
  end
end
