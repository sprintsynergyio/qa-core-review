import { Cart } from '../src/cart';

it('compares a value with itself', () => {
  const cart = new Cart([{ name: 'Backpack', price: 29.99 }]);
  const total = cart.total();
  expect(total).toBe(total); // expect: QCR-A002
  expect(cart.items.length).toEqual(cart.items.length); // expect: QCR-A002
  expect(cart.total()).toBeCloseTo(cart.total()); // expect: QCR-A002
  expect(cart.items).toStrictEqual( cart.items ); // expect: QCR-A002
});
