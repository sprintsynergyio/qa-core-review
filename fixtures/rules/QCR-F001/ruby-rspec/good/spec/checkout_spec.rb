require "checkout"

RSpec.describe Checkout do
  # fit "pays the order" was used while the sandbox was down
  it "pays the order" do
    totals = { backpack: 29.99 }
    expect(Checkout.new.pay("4111", totals[:backpack]).status).to eq("paid")
  end
end
