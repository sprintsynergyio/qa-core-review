require "order"

RSpec.describe Order do
  it "keeps the focus on the first open order" do
    orders = [Order.new("backpack"), Order.new("onesie")]
    expect(Order.focus(orders).item).to eq("backpack")
  end
end
