import { $, browser } from '@wdio/globals';

describe('Cart', () => {
  it('shows the badge', async () => {
    await browser.url('https://www.saucedemo.com/inventory.html');
    await expect($('[data-test="shopping-cart-badge"]')).toBeDisplayed();
    await expect(browser).toHaveTitle('Swag Labs');
  });
});
