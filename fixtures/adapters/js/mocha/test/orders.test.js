const { expect } = require('chai');
const assert = require('assert');
const sinon = require('sinon');
const orders = require('../src/orders');

describe('orders', function () {
  before(function () {
    this.clock = sinon.useFakeTimers();
  });

  after(function () {
    this.clock.restore();
  });

  context('create', function () {
    it('gives the order an id', function () {
      const order = orders.create({ item: 'backpack' });
      expect(order.id).to.be.a('string');
    });

    it('needs a database', function () {
      if (!process.env.DATABASE_URL) this.skip();
      assert.strictEqual(orders.count(), 1);
    });

    it('rejects an empty order');

    specify('an order has a creation time', function () {
      expect(orders.create({ item: 'light' }).createdAt).to.be.instanceOf(Date);
    });
  });

  describe.skip('cancel', function () {
    it('marks the order as cancelled', function () {
      const order = orders.create({ item: 'backpack' });
      orders.cancel(order.id);
      order.status.should.equal('cancelled');
    });
  });

  it.only('lists every order', function () {
    assert.equal(orders.list().length, 2);
  });
});
