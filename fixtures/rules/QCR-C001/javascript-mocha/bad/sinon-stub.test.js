const { expect } = require('chai');
const sinon = require('sinon');
const mailer = require('../src/mailer');
const { placeOrder } = require('../src/orders');

describe('orders', () => {
  it('sends a mail', () => {
    const send = sinon.stub(mailer, 'send').resolves(); // expect: QCR-C001
    placeOrder({ id: 7 });
    expect(send.calledWith('order-7')).to.equal(true);
  });
});
