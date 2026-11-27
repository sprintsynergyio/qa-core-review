require "order"

RSpec.describe Order do
  it "ships an order", focus: true do # expect: QCR-F001
    order = Order.new("backpack")
    expect(order.ship.status).to eq("shipped")
  end
end
