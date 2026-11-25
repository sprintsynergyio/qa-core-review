const { expect } = require('chai');
const sinon = require('sinon');
const cart = require('../src/cart');
const tax = require('../src/tax');

describe('cart', () => {
  afterEach(() => sinon.restore());

  it('returns the total', () => {
    sinon.stub(tax, 'rate').returns(0);
    expect(cart.getTotal([{ price: 40 }, { price: 2 }])).to.equal(42);
  });
});
