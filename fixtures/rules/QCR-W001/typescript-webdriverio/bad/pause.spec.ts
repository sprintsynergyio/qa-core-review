import { $, browser } from '@wdio/globals';

describe('Cart', () => {
  it('adds a backpack', async () => {
    await browser.url('https://www.saucedemo.com/inventory.html');
    await $('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    await browser.pause(3000); // expect: QCR-W001
    await expect($('[data-test="shopping-cart-badge"]')).toHaveText('1');
  });
});
