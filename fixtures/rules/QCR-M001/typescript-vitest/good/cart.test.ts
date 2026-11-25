import { expect, it, vi } from 'vitest';
import { getTotal } from '../src/cart';

// The dependency is mocked. The module under test is real.
vi.mock('../src/tax', () => ({ taxRate: () => 0 }));

it('returns the total', () => {
  expect(getTotal([{ price: 40 }, { price: 2 }])).toBe(42);
});
