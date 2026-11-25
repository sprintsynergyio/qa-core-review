import { formatPrice } from '../src/format';

// No suite: the tests of the file are one group.
test('formats dollars', () => { // expect: QCR-N001
  expect(formatPrice(29.99, 'USD')).toBe('$29.99');
});

test('formats euros', () => {
  expect(formatPrice(29.99, 'EUR')).toBe('29,99 €');
});

test('formats pounds', () => {
  expect(formatPrice(29.99, 'GBP')).toBe('£29.99');
});
