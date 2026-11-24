import { Cart } from '../src/cart';

function expectTotal(cart: Cart, total: number) {
  expect(cart.total()).toBeCloseTo(total);
}

test('checks through a helper in this file', () => {
  const cart = new Cart([{ name: 'Backpack', price: 29.99 }]);
  expectTotal(cart, 29.99);
});

test('fails by hand', () => {
  const cart = new Cart();
  if (cart.items.length !== 0) throw new Error('a new cart must be empty');
});
