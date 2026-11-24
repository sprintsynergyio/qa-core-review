const { expect } = require('chai');
const orders = require('../src/orders');

describe('orders with chai', function () {
  it('creates an order', function () {
    const order = orders.create({ items: ['backpack'] });
    expect(order.open).to.be.true;
    expect(order.items).to.have.lengthOf(1);
    expect(order.id).to.equal(orders.find(order.id).id);
    expect(order.coupon).to.be.null;
  });
});
