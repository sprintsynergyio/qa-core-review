require "cart"

RSpec.describe Cart do
  fit "adds an item" do # expect: QCR-F001
    cart = Cart.new
    cart.add("backpack", 1)
    expect(cart.size).to eq(1)
  end

  it "empties the cart" do
    expect(Cart.new.clear.size).to eq(0)
  end
end
