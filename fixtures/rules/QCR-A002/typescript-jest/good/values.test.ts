import { Cart } from '../src/cart';

it('adds items to the cart', () => {
  const cart = new Cart();
  const item = { name: 'Backpack', price: 29.99 };
  cart.add(item);
  expect(cart.items).toContainEqual(item);
  expect(cart.total()).toBe(29.99);
  expect(cart.isEmpty()).toBe(false);
  expect(cart.coupon).toBeNull();
});
