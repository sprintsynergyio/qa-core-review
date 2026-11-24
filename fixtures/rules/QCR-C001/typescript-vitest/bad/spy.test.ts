import { expect, it, vi } from 'vitest';
import { placeOrder } from '../src/orders';

it('logs the order', () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {}); // expect: QCR-C001
  placeOrder({ id: 7 });
  expect(log).toHaveBeenCalledWith('order 7 placed');
});
