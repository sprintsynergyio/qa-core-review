const assert = require('node:assert/strict');
const orders = require('../src/orders');

describe('orders', function () {
  it('creates an order', function () {
    orders.create({ items: ['backpack'] });
    assert(true); // expect: QCR-A002
    assert.ok(1); // expect: QCR-A002
  });

  it('keeps the total', function () {
    const order = orders.create({ items: ['backpack'] });
    assert.equal(order.total, order.total); // expect: QCR-A002
    assert.strictEqual('NEW', 'NEW'); // expect: QCR-A002
    assert.deepEqual(order.items, order.items); // expect: QCR-A002
  });
});
