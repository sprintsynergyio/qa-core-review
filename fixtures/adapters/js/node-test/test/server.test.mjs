import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { setTimeout as sleepFor } from 'node:timers/promises';
import { Cart } from '../src/cart.mjs';
import * as server from '../src/server.mjs';

test('replaces a method and puts it back', () => {
  const save = mock.method(Cart.prototype, 'save');
  new Cart([]).add({ name: 'Backpack', price: 29.99 });
  assert.equal(save.mock.callCount(), 1);
  save.mock.restore();
});

test('replaces a method and leaves it', () => {
  mock.method(server, 'listen');
  assert.ok(server.listen);
});

test('talks to the API', async () => {
  const created = await fetch('https://api.example.test/orders', { method: 'POST', body: '{}' });
  assert.equal(created.status, 201);
  await sleepFor(1000);
  const removed = await fetch('https://api.example.test/orders/1', { method: 'DELETE' });
  assert.equal(removed.status, 204);
});
