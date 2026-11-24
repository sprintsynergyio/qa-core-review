import { $$, browser } from '@wdio/globals';

describe('Inventory', () => {
  beforeEach(async () => {
    await browser.url('https://www.saucedemo.com/inventory.html');
    await browser.pause(1000); // expect: QCR-W001
  });

  it('shows six products', async () => {
    await expect($$('[data-test="inventory-item"]')).toBeElementsArrayOfSize(6);
  });
});
