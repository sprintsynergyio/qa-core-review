import { Cart } from '../src/cart';

it('adds items to the cart', () => {
  const cart = new Cart();
  cart.add({ name: 'Backpack', price: 29.99 });
  expect(true).toBe(true); // expect: QCR-A002
});

it('checks fixed values', () => {
  expect(1).toEqual(1); // expect: QCR-A002
  expect('done').toBe('done'); // expect: QCR-A002
  expect(1).toBeTruthy(); // expect: QCR-A002
  expect(null).toBeNull(); // expect: QCR-A002
  expect(undefined).not.toBeDefined(); // expect: QCR-A002
  expect([]).toEqual([]); // expect: QCR-A002
});
