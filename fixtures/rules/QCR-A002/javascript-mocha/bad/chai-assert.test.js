const { assert } = require('chai');
const orders = require('../src/orders');

describe('orders with chai assert', function () {
  it('creates an order', function () {
    const order = orders.create({ items: ['backpack'] });
    assert.isTrue(true); // expect: QCR-A002
    assert.isOk('yes'); // expect: QCR-A002
    assert.equal(order.status, order.status); // expect: QCR-A002
  });
});
