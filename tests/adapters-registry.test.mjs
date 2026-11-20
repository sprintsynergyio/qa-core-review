// The adapter registry (src/adapters/index.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AdapterRegistry, adapterProblems, builtinAdapters, createRegistry } from '../dist/index.js';
import { toyAdapter } from './helpers/toy-adapter.mjs';

const withChanges = (changes) => ({ ...toyAdapter, ...changes });

test('a valid adapter registers and can be looked up by id', () => {
  const registry = createRegistry([toyAdapter]);
  assert.equal(registry.get('toy'), toyAdapter);
  assert.equal(registry.get('nope'), undefined);
  assert.deepEqual(registry.list().map((adapter) => adapter.id), ['toy']);
});

test('adapters are listed in registration order', () => {
  const registry = new AdapterRegistry();
  registry.register(withChanges({ id: 'zeta' }));
  registry.register(withChanges({ id: 'alpha' }));
  assert.deepEqual(registry.list().map((adapter) => adapter.id), ['zeta', 'alpha']);
});

test('forPath matches extensions on the end of the path, in any case', () => {
  const registry = createRegistry([
    toyAdapter,
    withChanges({ id: 'collection', extensions: ['.toy_collection.json'] }),
    withChanges({ id: 'second-toy' }),
  ]);
  assert.deepEqual(registry.forPath('tests/cart.toy').map((adapter) => adapter.id), ['toy', 'second-toy']);
  assert.deepEqual(registry.forPath('tests/CART.TOY').map((adapter) => adapter.id), ['toy', 'second-toy']);
  assert.deepEqual(registry.forPath('api/shop.toy_collection.json').map((adapter) => adapter.id), ['collection']);
  assert.deepEqual(registry.forPath('src/CartSpec.scala'), []);
});

test('a duplicate id is refused', () => {
  const registry = createRegistry([toyAdapter]);
  assert.throws(() => registry.register(toyAdapter), /Cannot register adapter "toy": an adapter with id "toy" is already registered/);
});

test('an invalid adapter is refused with every problem listed', () => {
  const bad = withChanges({
    id: 'Toy Adapter',
    tier: 4,
    languages: ['generic', 'klingon'],
    extensions: ['toy', '.TOY'],
    capabilities: ['tests', 'tests', 'telepathy'],
  });
  assert.deepEqual(adapterProblems(bad), [
    'id "Toy Adapter" must be lower case letters, digits and dashes',
    'tier 4 must be 1, 2 or 3',
    'unknown language "klingon"',
    'extension "toy" must start with a dot and be lower case',
    'extension ".TOY" must start with a dot and be lower case',
    'capability "tests" is listed twice',
    'unknown capability "telepathy"',
  ]);
  assert.throws(() => new AdapterRegistry().register(bad), /Cannot register adapter "Toy Adapter": id "Toy Adapter" must be/);
  assert.deepEqual(adapterProblems(withChanges({ languages: [] })), ['languages must not be empty']);
  assert.deepEqual(adapterProblems(toyAdapter), []);
});

test('the built-in adapter list registers cleanly', () => {
  // Empty until Milestone 4. Every adapter added later must pass the same checks.
  const registry = createRegistry();
  assert.equal(registry.list().length, builtinAdapters.length);
});
