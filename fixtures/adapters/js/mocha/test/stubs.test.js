const { expect } = require('chai');
const sinon = require('sinon');
const { setTimeout } = require('node:timers/promises');
const orders = require('../src/orders');
const mailer = require('../src/mailer');

describe('orders with sinon', function () {
  afterEach(function () {
    sinon.restore();
  });

  it('stubs a dependency', async function () {
    const send = sinon.stub(mailer, 'send').resolves({ sent: true });
    const log = sinon.spy(console, 'log');
    await orders.create({ items: ['backpack'] });
    expect(send).to.have.been.calledOnce;
    expect(log).to.have.been.called;
  });

  it('stubs in every way', function () {
    const find = sinon.stub(orders, 'find');
    find.returns({ id: 'o-1' });
    const load = sinon.stub(orders, 'load').rejects(new Error('offline'));
    const save = sinon.stub(orders, 'save').callsFake(() => true);
    const remove = sinon.stub(orders, 'remove').throws(new Error('locked'));
    expect(orders.find('o-1')).to.deep.equal({ id: 'o-1' });
    expect([load, save, remove]).to.have.lengthOf(3);
  });

  it('moves a fake clock', function () {
    const clock = sinon.useFakeTimers();
    const order = orders.create({ items: ['backpack'] });
    clock.tick(60000);
    expect(orders.isExpired(order)).to.be.true;
    clock.restore();
  });

  it('sleeps for real', async function () {
    const order = orders.create({ items: ['backpack'] });
    await setTimeout(1500);
    await delay(100);
    await wait(100);
    await pause(100);
    expect(orders.isExpired(order)).to.be.false;
  });
});
