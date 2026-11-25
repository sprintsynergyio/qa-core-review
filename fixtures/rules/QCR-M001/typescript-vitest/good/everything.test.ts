import { expect, it, vi } from 'vitest';
import { placeOrder } from '../src/orders';
import { charge } from '../src/payments';
import type { Order } from '../src/types';

vi.mock('../src/payments');

it('charges the card', async () => {
  const order: Order = { id: 7, total: 32.39 };
  const placed = await placeOrder(order);
  expect(placed.status).toBe('paid');
  expect(charge).toHaveBeenCalledWith(32.39);
});
