const { expect } = require('chai');
const { Cart } = require('../src/cart');

describe.only('Cart', () => { // expect: QCR-F001
  it('starts empty', () => {
    expect(new Cart().items).to.have.length(0);
  });
});
