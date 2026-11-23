const chai = require('chai');
const { assert, expect } = require('chai');
const sinon = require('sinon');
const orders = require('../src/orders');

chai.should();

describe('chai expect', function () {
  it('reads like a sentence', function () {
    const order = orders.create({ items: ['backpack', 'bike light'], total: 39.98 });
    expect(order.id).to.be.a('string');
    expect(order.items).to.be.an('array').that.includes('backpack');
    expect(order.items).to.have.lengthOf(2);
    expect(order.items).to.have.length.above(1);
    expect(order.total).to.equal(39.98);
    expect(order.total).to.be.at.least(39).and.to.be.at.most(40);
    expect(order.total).to.be.above(0).but.not.below(39);
    expect(order.total).to.be.within(39, 40);
    expect(order.total).to.be.closeTo(40, 0.1);
    expect(order).to.have.property('status').which.equals('NEW');
    expect(order).to.have.all.keys('id', 'items', 'total', 'status', 'createdAt');
    expect(order).to.have.any.keys('id', 'missing');
    expect(order).to.have.nested.property('customer.name').that.is.a('string');
    expect(order).to.have.own.property('id');
    expect(order).to.deep.equal(orders.find(order.id));
    expect(order).to.eql(orders.find(order.id));
    expect(order.items).to.have.ordered.members(['backpack', 'bike light']);
    expect(order.items).to.have.same.members(['bike light', 'backpack']);
    expect(order.status).to.be.oneOf(['NEW', 'PAID']);
    expect(order.status).to.have.string('NE');
    expect(order.status).to.match(/^[A-Z]+$/);
    expect(order.status).to.contain('N').and.to.include('W');
    expect(order.status).to.eq('NEW');
    expect(order.status).matches(/NEW/).and.contains('E');
    expect(order.status).equals('NEW');
    expect(order.createdAt).to.be.instanceof(Date);
    expect(order.createdAt).to.be.an.instanceOf(Date);
    expect(order.total).to.be.gt(0).and.gte(39.98).and.lt(100).and.lte(39.98);
    expect(order.total).to.be.greaterThan(0).and.lessThan(100);
    expect(order).to.be.itself.ok;
    expect(order.items).to.have.been.with.of.is.has.does.still.also.not.empty;
  });

  it('checks with a property instead of a call', function () {
    const order = orders.create({ items: [] });
    expect(order.paid).to.be.false;
    expect(order.open).to.be.true;
    expect(order.coupon).to.be.null;
    expect(order.shippedAt).to.be.undefined;
    expect(order.items).to.be.empty;
    expect(order.id).to.exist;
    expect(order).to.be.ok;
    expect(order.total).to.not.be.NaN;
  });

  it('errors and promises', async function () {
    expect(() => orders.create({})).to.throw('items');
    await expect(orders.load('missing')).to.be.rejected;
    await expect(orders.load('missing')).to.be.rejectedWith('not found');
    await expect(orders.load('o-1')).to.be.fulfilled;
    await expect(orders.load('o-1')).to.eventually.have.property('id', 'o-1');
    expect(orders.load('o-1')).to.eventually.have.property('status');
    return expect(orders.load('o-1')).to.eventually.be.ok;
  });

  it('is never finished', function () {
    const order = orders.create({ items: [] });
    expect(order.total).to.be;
    expect(order.total).to.equal;
    expect(order.total);
  });
});

describe('chai should and assert', function () {
  it('should style', function () {
    const order = orders.create({ items: ['backpack'] });
    order.status.should.equal('NEW');
    order.items.should.have.lengthOf(1);
    order.open.should.be.true;
    order.total.should.not.be.below(0);
    orders.find(order.id).should.deep.equal(order);
  });

  it('assert style', function () {
    const order = orders.create({ items: ['backpack'] });
    assert.isTrue(order.open);
    assert.isFalse(order.paid);
    assert.isOk(order.id);
    assert.isNotOk(order.coupon);
    assert.isNull(order.coupon);
    assert.isNotNull(order.id);
    assert.isUndefined(order.shippedAt);
    assert.isDefined(order.createdAt);
    assert.exists(order.id);
    assert.notExists(order.coupon);
    assert.equal(order.status, 'NEW');
    assert.include(order.items, 'backpack');
    assert.notInclude(order.items, 'bike light');
    assert.lengthOf(order.items, 1);
    assert.isAbove(order.total, 0);
    assert.isAtLeast(order.total, 0);
    assert.isBelow(order.total, 100);
    assert.isAtMost(order.total, 100);
    assert.typeOf(order.id, 'string');
    assert.instanceOf(order.createdAt, Date);
    assert.isString(order.id);
    assert.isNumber(order.total);
    assert.isArray(order.items);
    assert.isObject(order);
    assert.isFunction(orders.create);
    assert.isBoolean(order.open);
    assert.closeTo(order.total, 30, 0.1);
    chai.assert.isOk(order);
    chai.expect(order.id).to.exist;
  });
});

describe('sinon', function () {
  it('checks calls with sinon-chai', function () {
    const notify = sinon.spy();
    const save = sinon.stub(orders, 'save').resolves();
    const log = sinon.fake();
    orders.create({ items: ['backpack'] }, { notify, log });
    expect(notify).to.have.been.called;
    expect(notify).to.have.been.calledOnce;
    expect(notify).to.not.have.been.calledTwice;
    expect(notify).to.have.been.calledWith('order created');
    expect(notify).to.have.been.calledOnceWith('order created');
    expect(save).to.have.been.calledWithExactly(sinon.match.object);
    expect(save).to.have.callCount(1);
    expect(log).to.have.been.notCalled;
    notify.should.have.been.calledOnce;
  });

  it('checks calls with sinon.assert', function () {
    const notify = sinon.spy();
    orders.create({ items: ['backpack'] }, { notify });
    sinon.assert.calledOnce(notify);
    sinon.assert.calledWith(notify, 'order created');
  });
});

describe('callbacks and promises', function () {
  it('passes a failure to done', function (done) {
    orders.onCreated(function (order) {
      try {
        expect(order.status).to.equal('NEW');
        done();
      } catch (error) {
        done(error);
      }
    });
    orders.create({ items: ['backpack'] });
  });

  it('checks inside then, and hides a failure in catch', function () {
    return orders
      .load('o-1')
      .then((order) => {
        expect(order.status).to.equal('NEW');
      })
      .catch(() => {});
  });

  it('waits for an event inside a promise', function () {
    return new Promise((resolve) => {
      orders.onCreated((order) => {
        expect(order.id).to.exist;
        resolve();
      });
      orders.create({ items: ['backpack'] });
    });
  });

  it('checks only when the promise fails', function () {
    return orders.load('missing').catch((error) => {
      expect(error.message).to.include('not found');
    });
  });
});
