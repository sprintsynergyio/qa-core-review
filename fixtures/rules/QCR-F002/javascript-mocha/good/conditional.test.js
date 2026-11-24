const { expect } = require('chai');
const { fetchOrder } = require('../src/orders');

describe('orders', () => {
  it('loads order 7 from the live API', async function () {
    if (!process.env.API_URL) this.skip();
    expect((await fetchOrder(7)).id).to.equal(7);
  });
});
