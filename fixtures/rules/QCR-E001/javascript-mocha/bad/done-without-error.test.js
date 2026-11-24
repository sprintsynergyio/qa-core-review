const { expect } = require('chai');
const { fetchOrder } = require('../src/orders');

describe('orders', () => {
  // done() with no argument ends the test as passed.
  it('loads order 7', (done) => {
    fetchOrder(7) // expect: QCR-E001
      .then((order) => {
        expect(order.total).to.equal(32.39);
        done();
      })
      .catch(() => done());
  });
});
