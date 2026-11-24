const { expect } = require('chai');
const sinon = require('sinon');
const { Session } = require('../src/session');

describe('Session', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('expires after 45 minutes with the long setting', () => {
    const clock = sinon.useFakeTimers();
    const session = new Session({ minutes: 45 });
    clock.tick(45 * 60 * 1000);
    expect(session.expired).to.equal(true);
  });
});
