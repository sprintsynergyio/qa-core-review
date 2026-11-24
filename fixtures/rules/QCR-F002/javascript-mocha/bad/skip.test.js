const { expect } = require('chai');
const { priceOf } = require('../src/price');

describe('prices', () => {
  it.skip('prices a backpack', () => { // expect: QCR-F002
    expect(priceOf('backpack')).to.equal(29.99);
  });

  xit('prices a bike light', () => { // expect: QCR-F002
    expect(priceOf('bike-light')).to.equal(9.99);
  });
});

describe.skip('discounts', () => { // expect: QCR-F002
  it('takes 10 percent off', () => {
    expect(priceOf('backpack', { code: 'SAUCE10' })).to.equal(26.99);
  });
});
