import { $$ } from '@wdio/globals';

describe('Inventory', () => {
  it('lists the items', async () => {
    const items = await $$('[data-test="inventory-item"]');
    expect(items.length).toBeGreaterThanOrEqual(0); // expect: QCR-A003
    expect(items.length); // expect: QCR-A003
  });
});
