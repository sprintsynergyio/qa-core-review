import assert from 'node:assert/strict';
import { describe, it, mock, test } from 'node:test';
import { Cart, loadCart } from '../src/cart.mjs';
import { inject } from '../src/server.mjs';

const backpack = { name: 'Backpack', price: 29.99 };

describe('node assert', () => {
  it('equality', () => {
    const cart = new Cart([backpack]);
    assert(cart.has('Backpack'));
    assert.ok(cart.has('Backpack'), 'the backpack is in the cart');
    assert.equal(cart.items.length, 1);
    assert.strictEqual(cart.total(), 29.99);
    assert.deepEqual(cart.items, [backpack]);
    assert.deepStrictEqual(cart.items[0], backpack);
    assert.notEqual(cart.total(), 0);
    assert.notStrictEqual(cart.total(), '29.99');
    assert.notDeepEqual(cart.items, []);
    assert.notDeepStrictEqual(cart.items, [{}]);
    assert.match(cart.summary(), /1 item/);
    assert.doesNotMatch(cart.summary(), /empty/);
  });

  it('errors', async () => {
    const cart = new Cart([]);
    assert.throws(() => cart.checkout(), /empty/);
    assert.doesNotThrow(() => cart.add(backpack));
    await assert.rejects(loadCart('missing'), { code: 404 });
    await assert.doesNotReject(loadCart('c-1'));
    assert.rejects(loadCart('missing'));
  });

  it('trivial and fixed', () => {
    assert(true);
    assert.ok(1);
    assert.equal(backpack.price, backpack.price);
    console.assert(backpack.price > 0, 'console.assert never fails a test');
  });

  it('fails by hand', () => {
    const cart = new Cart([backpack]);
    if (cart.total() <= 0) assert.fail('the total must be positive');
  });

  it('status codes', async () => {
    const response = await fetch('https://api.example.test/orders/missing');
    assert.equal(response.status, 404);
    assert.strictEqual(response.status, 404, 'a missing order gives 404');
    const reply = await inject({ method: 'POST', url: '/orders' });
    assert.equal(reply.statusCode, 201);
  });
});

test('the test context has its own assert', (t) => {
  const onChange = mock.fn();
  const save = mock.method(Cart.prototype, 'save');
  const cart = new Cart([], { onChange });
  cart.add(backpack);
  t.assert.equal(onChange.mock.calls.length, 1);
  t.assert.strictEqual(save.mock.callCount(), 0);
});
