const { expect } = require('chai');
const sinon = require('sinon');
const http = require('../src/http');
const rates = require('../src/rates');

describe('rates', () => {
  afterEach(() => sinon.restore());

  it('loads the rates', async () => {
    sinon.stub(http, 'get').resolves({ rates: { EUR: 0.92 } });
    expect(await rates.load()).to.deep.equal({ EUR: 0.92 });
  });
});
