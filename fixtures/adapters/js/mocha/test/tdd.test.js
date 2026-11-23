import { describe, it } from 'mocha';
import assert from 'node:assert';
import { total } from '../src/total.js';

suite('total', () => {
  test('adds the prices', () => {
    assert.equal(total([10, 5]), 15);
  });

  describe('with no prices', () => {
    it('is zero', () => {
      assert.equal(total([]), 0);
    });
  });
});
