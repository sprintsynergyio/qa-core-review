import { setTimeout } from 'node:timers/promises';
import { Cache } from '../src/cache';

test('an entry expires', async () => {
  const cache = new Cache({ ttlMs: 400 });
  cache.set('rate', 1.2);
  await setTimeout(500); // expect: QCR-W001
  expect(cache.get('rate')).toBeUndefined();
});
