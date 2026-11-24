const { expect } = require('chai');
const { loadRates } = require('../src/rates');

describe('rates', () => {
  before(() => {
    global.fetch = async () => ({ json: async () => ({ EUR: 0.92 }) }); // expect: QCR-C001
  });

  it('loads the rates', async () => {
    expect(await loadRates()).to.deep.equal({ EUR: 0.92 });
  });
});
