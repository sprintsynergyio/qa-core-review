import { expect, it, vi } from 'vitest';
import { placeOrder } from '../src/orders';
import { charge } from '../src/payments';
import type { Order } from '../src/types';

// Every module this file imports is a mock, so no real code runs.
vi.mock('../src/orders'); // expect: QCR-M001
vi.mock('../src/payments');

it('charges the card', async () => {
  const order: Order = { id: 7, total: 32.39 };
  await placeOrder(order);
  expect(charge).toHaveBeenCalledWith(32.39); // expect: QCR-M001
});
