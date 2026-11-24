import { $, $$, browser } from '@wdio/globals';

describe('Inventory', () => {
  it('adds the second product', async () => {
    await browser.url('https://www.saucedemo.com/inventory.html');
    await $('.inventory_list > div:nth-child(2) button').click(); // expect: QCR-S001
    await $('#root > div > div > div > button').click(); // expect: QCR-S001
    await expect($$('#root > div > div > div > .cart_item')).toBeElementsArrayOfSize(2); // expect: QCR-S001
  });
});
