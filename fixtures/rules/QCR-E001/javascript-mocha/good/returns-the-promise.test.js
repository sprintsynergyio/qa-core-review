const { expect } = require('chai');
const { fetchOrder } = require('../src/orders');

describe('orders', () => {
  it('loads order 9', () => {
    return fetchOrder(9).then((order) => expect(order.id).to.equal(9));
  });

  it('loads order 10', async () => {
    const order = await fetchOrder(10);
    expect(order.id).to.equal(10);
  });
});
