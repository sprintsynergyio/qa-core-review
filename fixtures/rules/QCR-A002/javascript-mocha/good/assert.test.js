const assert = require('node:assert/strict');
const orders = require('../src/orders');

describe('orders', function () {
  it('creates an order', function () {
    const order = orders.create({ items: ['backpack'] });
    assert(order.id);
    assert.ok(order.open);
    assert.equal(order.status, 'NEW');
    assert.deepEqual(order.items, ['backpack']);
  });
});
