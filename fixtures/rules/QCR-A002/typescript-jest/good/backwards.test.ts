import { Cart, nextId } from '../src/cart';

// The expected value is written first. Not the usual order, but a real check.
it('counts the items', () => {
  const cart = new Cart([{ name: 'Backpack', price: 29.99 }]);
  expect(1).toBe(cart.items.length);
  expect([]).toEqual(new Cart().items);
  expect('Backpack').toEqual(cart.items[0].name);
});

it('gives a new id each time', () => {
  expect(nextId()).not.toBe(nextId());
});
