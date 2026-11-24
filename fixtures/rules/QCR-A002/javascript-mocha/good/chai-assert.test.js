const { assert } = require('chai');
const orders = require('../src/orders');

describe('orders with chai assert', function () {
  it('creates an order', function () {
    const order = orders.create({ items: ['backpack'] });
    assert.isTrue(order.open);
    assert.isOk(order.id);
    assert.equal(order.status, 'NEW');
    assert.equal(2, orders.create({ items: ['a', 'b'] }).items.length);
  });
});
