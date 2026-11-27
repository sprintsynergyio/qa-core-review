require "cart"

RSpec.describe Cart do
  it "adds an item" do
    cart = Cart.new
    cart.add("backpack", 1)
    expect(cart.size).to eq(1)
  end
end
