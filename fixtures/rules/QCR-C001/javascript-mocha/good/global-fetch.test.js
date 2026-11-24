const { expect } = require('chai');
const { loadRates } = require('../src/rates');

describe('rates', () => {
  const realFetch = global.fetch;

  before(() => {
    global.fetch = async () => ({ json: async () => ({ GBP: 0.79 }) });
  });

  after(() => {
    global.fetch = realFetch;
  });

  it('loads the rates', async () => {
    expect(await loadRates()).to.deep.equal({ GBP: 0.79 });
  });
});
