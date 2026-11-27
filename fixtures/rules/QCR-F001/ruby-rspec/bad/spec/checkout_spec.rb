require "checkout"

RSpec.describe Checkout do
  it "pays the order", :focus do # expect: QCR-F001
    expect(Checkout.new.pay("4111", 29.99).status).to eq("paid")
  end
end
