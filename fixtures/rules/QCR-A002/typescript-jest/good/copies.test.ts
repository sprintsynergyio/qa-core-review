import { Cart } from '../src/cart';

it('copies a cart', () => {
  const cart = new Cart([{ name: 'Backpack', price: 29.99 }]);
  const copy = cart.clone();
  expect(copy.items).toEqual(cart.items);
  expect(copy.total()).toBe(cart.total());
  expect(copy).not.toBe(cart);
});
