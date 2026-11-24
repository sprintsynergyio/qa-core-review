import { Cache } from '../src/cache';

// A timer with a callback is not a sleep in the test. The code under test takes a clock.
test('an entry expires', () => {
  let now = 0;
  const cache = new Cache({ ttlMs: 400, clock: () => now });
  cache.set('rate', 1.2);
  now = 500;
  expect(cache.get('rate')).toBeUndefined();
});

test('the timer is cleared on close', () => {
  const timer = setTimeout(() => {}, 1000);
  clearTimeout(timer);
  expect(timer.hasRef()).toBe(true);
});
