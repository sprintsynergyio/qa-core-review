import { formatReceipt } from '../src/receipt';

it('formats the receipt', () => {
  const receipt = formatReceipt({ items: ['backpack'], tax: 2.4 });
  expect(receipt.total).toBe('$32.39');
  expect(receipt.lines).toMatchInlineSnapshot(`"Backpack $29.99, Tax $2.40"`);
});

it('refuses an empty order', () => {
  expect(() => formatReceipt({ items: [], tax: 0 })).toThrow('An order needs at least one item');
});
