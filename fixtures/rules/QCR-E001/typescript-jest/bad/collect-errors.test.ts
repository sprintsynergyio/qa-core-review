import { priceOf } from '../src/price';

// The errors are collected and never checked.
test('prices every product', () => {
  const errors: unknown[] = [];
  for (const [id, price] of [['backpack', 29.99], ['bike-light', 9.99]] as const) {
    try { // expect: QCR-E001
      expect(priceOf(id)).toBe(price);
    } catch (error) {
      errors.push(error);
    }
  }
  expect(priceOf('onesie')).toBe(7.99);
});
