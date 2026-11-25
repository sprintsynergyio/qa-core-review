import { expect, it, vi } from 'vitest';
import { placeOrder } from '../src/orders';

it('logs the order', () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {}); // expect: QCR-C001
  expect(placeOrder({ id: 7 })).toEqual({ id: 7, status: 'placed' });
  expect(log).toHaveBeenCalledWith('order 7 placed');
});
