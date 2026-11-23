import assert from 'node:assert/strict';
import test, { describe, it } from 'node:test';
import { Cart } from '../src/cart.mjs';

test('a new cart is empty', () => {
  assert.equal(new Cart().count(), 0);
});

test('talks to the payment service', { skip: 'needs a sandbox account' }, async () => {
  const cart = new Cart();
  assert.ok(await cart.pay());
});

test('exports to CSV', { todo: true }, () => {});

test('is focused', { only: true }, () => {
  assert.ok(true);
});

describe('Cart', () => {
  it('adds an item', () => {
    const cart = new Cart();
    cart.add('backpack', 29.99);
    assert.deepEqual(cart.items, [['backpack', 29.99]]);
  });

  it.skip('removes an item', () => {});

  it.todo('merges two carts');
});

test(function namedTest() {
  assert.strictEqual(1 + 1, 2);
});
