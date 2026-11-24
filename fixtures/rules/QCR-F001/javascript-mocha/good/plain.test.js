const { expect } = require('chai');
const { Cart } = require('../src/cart');

describe('Cart', () => {
  context('with one item', () => {
    specify('has a total', () => {
      expect(new Cart().add('backpack').total).to.equal(29.99);
    });
  });
});
