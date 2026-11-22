import { Cart } from './cart';

describe('Cart', () => {
  test('adds an item', () => {
    const cart = new Cart();
    cart.add({ name: 'Backpack', price: 29.99 });
    expect(cart.count()).toBe(1);
    expect(cart.total()).toBe(29.99);
  });

  test('starts empty', () => {
    const cart = new Cart();
    expect(cart.count()).toBe(0);
  });
});
