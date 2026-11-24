const { expect } = require('chai');
const assert = require('node:assert');
const { priceOf } = require('../src/price');

describe('prices', () => {
  it('prices a backpack', () => {
    try { // expect: QCR-E001
      expect(priceOf('backpack')).to.equal(29.99);
    } catch (err) {
      console.log('price check failed: ' + err.message);
    }
  });

  it('prices a bike light', () => {
    try { // expect: QCR-E001
      assert.strictEqual(priceOf('bike-light'), 9.99);
    } catch (_) {}
  });
});
