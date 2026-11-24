import { $, browser } from '@wdio/globals';

describe('Inventory', () => {
  it('adds two products', async () => {
    await browser.url('https://www.saucedemo.com/inventory.html');
    await $('//div[3]/div[2]/button[2]').click(); // expect: QCR-S001
    await $('/html/body/div/div/button').click(); // expect: QCR-S001
    await expect($('[data-test="shopping-cart-badge"]')).toHaveText('2');
  });
});
