import { Cart } from '../src/cart';

test('an empty cart costs nothing', () => {
  const cart = new Cart();
  expect(cart.total).toBe(0);
  expect(cart.items).toHaveLength(0);
});

test('an empty cart has no total', () => { // expect: QCR-D001
  const cart = new Cart();
  expect(cart.total).toBe(0);
  expect(cart.items).toHaveLength(0);
});
