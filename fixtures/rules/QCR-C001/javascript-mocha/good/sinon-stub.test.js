const { expect } = require('chai');
const sinon = require('sinon');
const mailer = require('../src/mailer');
const { placeOrder } = require('../src/orders');

describe('orders', () => {
  it('sends a mail', () => {
    const send = sinon.stub(mailer, 'send').resolves();
    placeOrder({ id: 8 });
    expect(send.calledWith('order-8')).to.equal(true);
    send.restore();
  });
});
