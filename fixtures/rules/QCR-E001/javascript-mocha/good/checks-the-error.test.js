const { expect } = require('chai');
const { createOrder } = require('../src/orders');

describe('orders', () => {
  it('rejects an order with no items', async () => {
    try {
      await createOrder({ items: [] });
      expect.fail('createOrder should have thrown');
    } catch (error) {
      expect(error.field).to.equal('items');
    }
  });

  it('closes the connection whatever happens', async function () {
    const db = await this.openDb();
    try {
      expect(await db.count('orders')).to.equal(0);
    } finally {
      await db.close();
    }
  });
});
