const { expect } = require('chai');
const { Cart } = require('../src/cart');

describe('Cart', () => {
  // A test with no function is pending: Mocha lists it and runs nothing.
  it('exports to CSV'); // expect: QCR-F002

  it('starts empty', () => {
    expect(new Cart().items).to.have.length(0);
  });
});
