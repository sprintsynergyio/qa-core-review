import { formatPrice } from '../src/price';

it('formats a price', () => {
  expect(formatPrice(29.99)).toBe('$29.99');
});
