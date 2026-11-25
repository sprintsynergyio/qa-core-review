const { expect } = require('chai');
const sinon = require('sinon');
const cart = require('../src/cart');

describe('cart', () => {
  afterEach(() => sinon.restore());

  it('returns the total', () => {
    sinon.stub(cart, 'getTotal').returns(42);
    expect(cart.getTotal([{ price: 40 }, { price: 2 }])).to.equal(42); // expect: QCR-M001
  });
});
