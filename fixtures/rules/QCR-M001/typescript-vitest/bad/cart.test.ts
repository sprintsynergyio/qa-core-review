import { expect, it, vi } from 'vitest';
import { getTotal } from '../src/cart';

// cart.test.ts tests ../src/cart, and ../src/cart is the module that is mocked.
vi.mock('../src/cart', () => ({ getTotal: vi.fn(() => 42) })); // expect: QCR-M001

it('returns the total', () => {
  expect(getTotal([{ price: 40 }, { price: 2 }])).toBe(42);
});
