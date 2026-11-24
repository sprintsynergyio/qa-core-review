import { $, browser } from '@wdio/globals';

describe('Cart', () => {
  it('adds a backpack', async () => {
    await browser.url('https://www.saucedemo.com/inventory.html');
    await $('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    await $('#shopping_cart_container').click();
    await expect($('[data-test="inventory-item-name"]')).toHaveText('Sauce Labs Backpack');
  });
});
