const { expect } = require('chai');
const { fetchOrder } = require('../src/orders');

describe('orders', () => {
  // done gets the error, so the test fails.
  it('loads order 7', (done) => {
    fetchOrder(7)
      .then((order) => {
        expect(order.total).to.equal(32.39);
        done();
      })
      .catch(done);
  });

  it('loads order 8', (done) => {
    fetchOrder(8)
      .then((order) => {
        expect(order.id).to.equal(8);
        done();
      })
      .catch((error) => done(error));
  });
});
