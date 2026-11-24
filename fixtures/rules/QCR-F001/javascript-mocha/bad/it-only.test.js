const { expect } = require('chai');
const { priceOf } = require('../src/price');

describe('prices', () => {
  it.only('prices a backpack', () => { // expect: QCR-F001
    expect(priceOf('backpack')).to.equal(29.99);
  });

  it('prices a bike light', () => {
    expect(priceOf('bike-light')).to.equal(9.99);
  });
});
