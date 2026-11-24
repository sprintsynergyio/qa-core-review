import { $, browser } from '@wdio/globals';

describe('Cart', () => {
  it('adds a backpack', async () => {
    await browser.url('https://www.saucedemo.com/inventory.html');
    await $('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    await $('[data-test="shopping-cart-badge"]').waitForDisplayed({ timeout: 5000 });
    await expect($('[data-test="shopping-cart-badge"]')).toHaveText('1');
  });

  it('opens the cart', async () => {
    await browser.url('https://www.saucedemo.com/inventory.html');
    await $('[data-test="shopping-cart-link"]').click();
    await browser.waitUntil(async () => (await browser.getUrl()).includes('cart.html'), { timeout: 5000 });
    await expect($('[data-test="cart-list"]')).toBeDisplayed();
  });
});
