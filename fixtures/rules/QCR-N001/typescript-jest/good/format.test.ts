import { formatPrice } from '../src/format';

test('formats dollars', () => {
  expect(formatPrice(29.99, 'USD')).toBe('$29.99');
});

test('formats euros', () => {
  expect(formatPrice(29.99, 'EUR')).toBe('29,99 €');
});

// An error case found by its assertion: the title has no error word in it.
test('knows three currencies', () => {
  expect(() => formatPrice(29.99, 'XXX')).toThrow();
});
