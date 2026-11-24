import { formatPrice } from '../src/price';

it('formats a price', () => {
  expect(formatPrice(29.99)).toMatchInlineSnapshot(`"$29.99"`); // expect: QCR-P001
});
