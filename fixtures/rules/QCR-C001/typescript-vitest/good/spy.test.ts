import { afterEach, expect, it, vi } from 'vitest';
import { placeOrder } from '../src/orders';

afterEach(() => {
  vi.restoreAllMocks();
});

it('logs the order', () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  placeOrder({ id: 8 });
  expect(log).toHaveBeenCalledWith('order 8 placed');
});

// A spy that is restored where it is made is fine too.
it('warns about an empty order', () => {
  const warn = vi.spyOn(console, 'warn');
  placeOrder({ id: 9, items: [] });
  expect(warn).toHaveBeenCalledTimes(1);
  warn.mockRestore();
});
