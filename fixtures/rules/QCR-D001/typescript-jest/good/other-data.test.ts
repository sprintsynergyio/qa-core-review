import { Cart } from '../src/cart';

it('takes 10 percent off', () => {
  const cart = new Cart().add('backpack').applyCode('SAUCE10');
  expect(cart.total).toBe(26.99);
});

it('takes 20 percent off', () => {
  const cart = new Cart().add('backpack').applyCode('SAUCE20');
  expect(cart.total).toBe(23.99);
});
