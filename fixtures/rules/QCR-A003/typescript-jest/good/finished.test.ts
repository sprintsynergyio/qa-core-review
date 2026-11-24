import { Cart } from '../src/cart';

it('has a total', () => {
  const cart = new Cart([{ name: 'Backpack', price: 29.99 }]);
  expect(cart.total()).toBeDefined();
  expect(cart.items).not.toHaveLength(0);
  // An assertion kept in a variable may be finished later, so it is left alone.
  const total = expect(cart.total());
  total.toBe(29.99);
});
