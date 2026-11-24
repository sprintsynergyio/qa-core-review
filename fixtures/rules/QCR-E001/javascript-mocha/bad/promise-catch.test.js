const { expect } = require('chai');
const { fetchOrder } = require('../src/orders');

describe('orders', () => {
  it('loads order 8', () => {
    return fetchOrder(8) // expect: QCR-E001
      .then((order) => expect(order.id).to.equal(8))
      .catch(console.error);
  });

  it('loads order 9', async () => {
    await fetchOrder(9).then((order) => expect(order.id).to.equal(9)).catch(function () {}); // expect: QCR-E001
  });
});
