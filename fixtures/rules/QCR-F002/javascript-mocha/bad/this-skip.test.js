const { expect } = require('chai');
const { fetchOrder } = require('../src/orders');

describe('orders', () => {
  it('loads order 7', async function () { // expect: QCR-F002
    this.skip();
    expect((await fetchOrder(7)).id).to.equal(7);
  });

  xdescribe('refunds', () => { // expect: QCR-F002
    it('refunds order 7', async () => {
      expect((await fetchOrder(7)).refunded).to.equal(true);
    });
  });
});
