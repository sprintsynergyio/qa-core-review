const { expect } = require('chai');
const { Cart } = require('../src/cart');

describe('Cart', () => {
  context.only('with one item', () => { // expect: QCR-F001
    specify.only('has a total', () => { // expect: QCR-F001
      expect(new Cart().add('backpack').total).to.equal(29.99);
    });
  });
});
