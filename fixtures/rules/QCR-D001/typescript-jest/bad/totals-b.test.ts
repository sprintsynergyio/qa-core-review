import { Cart } from '../src/cart';

// The evidence names the first copy, in totals-a.test.ts.
test('a new cart is empty', () => { // expect: QCR-D001
  const cart = new Cart();
  expect(cart.total).toBe(0);
  expect(cart.items).toHaveLength(0);
});
