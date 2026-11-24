import { expect, it } from 'vitest';
import { renderInvoice } from '../src/invoice';

it('renders the invoice', async () => {
  const html = renderInvoice({ id: 7, total: 32.39 });
  expect(html).toContain('Invoice 7');
  expect(html).toContain('$32.39');
  await expect(html).toMatchFileSnapshot('./invoice-7.html');
});
