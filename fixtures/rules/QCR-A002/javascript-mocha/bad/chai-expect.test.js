const { expect } = require('chai');
const orders = require('../src/orders');

describe('orders with chai', function () {
  it('creates an order', function () {
    const order = orders.create({ items: ['backpack'] });
    expect(true).to.be.true; // expect: QCR-A002
    expect(1).to.equal(1); // expect: QCR-A002
    expect(order.id).to.equal(order.id); // expect: QCR-A002
    expect(null).to.be.null; // expect: QCR-A002
  });
});
