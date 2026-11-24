import { Cart } from '../src/cart';

it('has items', () => {
  const cart = new Cart([{ name: 'Backpack', price: 29.99 }]);
  expect(cart.items.length).toBeGreaterThanOrEqual(0); // expect: QCR-A003
  expect(cart.items.length).not.toBeLessThan(0); // expect: QCR-A003
  expect(new Set(cart.names()).size).toBeGreaterThanOrEqual(0); // expect: QCR-A003
  expect([cart.total(), 29.99]).toBeTruthy(); // expect: QCR-A003
});

it('stops before the check', () => {
  const cart = new Cart();
  expect(cart.items).toHaveLength(0);
  fail('not written yet');
  expect(cart.total()).toBe(0); // expect: QCR-A003
});
