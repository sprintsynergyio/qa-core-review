import { formatReceipt } from '../src/receipt';

// The snapshot is empty: the next run writes whatever the code gives into this file.
it('formats the receipt', () => {
  const receipt = formatReceipt({ items: ['backpack'], tax: 2.4 });
  expect(receipt.total).toBe('$32.39');
  expect(receipt.lines).toMatchInlineSnapshot(); // expect: QCR-P001
});

it('refuses an empty order', () => {
  expect(() => formatReceipt({ items: [], tax: 0 })).toThrowErrorMatchingInlineSnapshot(); // expect: QCR-P001
});
