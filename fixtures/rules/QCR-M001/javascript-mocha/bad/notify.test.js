const sinon = require('sinon');
const mailer = require('../src/mailer');
const { notify } = require('../src/notify');

describe('notify', () => {
  afterEach(() => sinon.restore());

  it('sends a mail', async () => {
    const send = sinon.stub(mailer, 'send').resolves();
    await notify({ id: 7 });
    sinon.assert.calledOnce(send); // expect: QCR-M001
  });
});
