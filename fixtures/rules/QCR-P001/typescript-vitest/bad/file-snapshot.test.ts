import { expect, it } from 'vitest';
import { renderInvoice } from '../src/invoice';

it('renders the invoice', async () => {
  await expect(renderInvoice({ id: 7, total: 32.39 })).toMatchFileSnapshot('./invoice-7.html'); // expect: QCR-P001
});
