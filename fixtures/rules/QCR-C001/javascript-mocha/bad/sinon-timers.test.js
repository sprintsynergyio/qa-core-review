const { expect } = require('chai');
const sinon = require('sinon');
const { Session } = require('../src/session');

describe('Session', () => {
  it('expires after 30 minutes', () => {
    const clock = sinon.useFakeTimers(); // expect: QCR-C001
    const session = new Session();
    clock.tick(30 * 60 * 1000);
    expect(session.expired).to.equal(true);
  });
});
