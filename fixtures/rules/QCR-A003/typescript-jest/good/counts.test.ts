import { Cart } from '../src/cart';

it('has items', () => {
  const cart = new Cart([{ name: 'Backpack', price: 29.99 }]);
  expect(cart.items.length).toBeGreaterThan(0);
  expect(cart.items.length).toBeGreaterThanOrEqual(1);
  expect(cart.items.length).toBeLessThan(5);
  expect(cart.total()).toBeGreaterThanOrEqual(0);
  expect([cart.total(), 29.99]).toEqual([29.99, 29.99]);
});
