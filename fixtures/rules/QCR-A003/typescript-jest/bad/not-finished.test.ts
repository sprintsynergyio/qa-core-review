import { Cart } from '../src/cart';

it('has a total', () => {
  const cart = new Cart([{ name: 'Backpack', price: 29.99 }]);
  expect(cart.total()); // expect: QCR-A003
  expect(cart.total()).toBeDefined; // expect: QCR-A003
  expect(cart.items).not; // expect: QCR-A003
  expect(cart.items).toHaveLength(1);
});
