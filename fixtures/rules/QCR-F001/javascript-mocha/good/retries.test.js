const { expect } = require('chai');
const { fetchOrder } = require('../src/orders');

describe('orders', function () {
  this.timeout(5000);

  it('loads order 7', async () => {
    expect((await fetchOrder(7)).id).to.equal(7);
  });
});
