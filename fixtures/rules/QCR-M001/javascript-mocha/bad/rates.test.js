const { expect } = require('chai');
const sinon = require('sinon');
const rates = require('../src/rates');

describe('rates', () => {
  afterEach(() => sinon.restore());

  it('loads the rates', async () => {
    const load = sinon.stub(rates, 'load');
    load.resolves({ EUR: 0.92 });
    expect(await rates.load()).to.deep.equal({ EUR: 0.92 }); // expect: QCR-M001
  });
});
