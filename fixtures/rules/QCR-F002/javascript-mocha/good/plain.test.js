const { expect } = require('chai');
const { Cart } = require('../src/cart');

describe('Cart', () => {
  it('starts empty', () => {
    expect(new Cart().items).to.have.length(0);
  });
});
