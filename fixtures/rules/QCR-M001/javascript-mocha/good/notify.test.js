const { expect } = require('chai');
const sinon = require('sinon');
const mailer = require('../src/mailer');
const { notify } = require('../src/notify');

describe('notify', () => {
  afterEach(() => sinon.restore());

  it('sends a mail', async () => {
    const send = sinon.stub(mailer, 'send').resolves();
    const result = await notify({ id: 7 });
    expect(result).to.deep.equal({ order: 7, mailed: true });
    sinon.assert.calledOnce(send);
  });
});
