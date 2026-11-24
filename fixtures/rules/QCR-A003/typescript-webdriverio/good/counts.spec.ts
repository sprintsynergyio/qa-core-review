import { $$ } from '@wdio/globals';

describe('Inventory', () => {
  it('lists the items', async () => {
    const items = await $$('[data-test="inventory-item"]');
    expect(items.length).toBe(6);
    await expect($$('[data-test="inventory-item"]')).toBeElementsArrayOfSize(6);
  });
});
