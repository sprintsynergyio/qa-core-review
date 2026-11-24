import { $, browser } from '@wdio/globals';

describe('Cart', () => {
  it('shows the badge', async () => {
    await browser.url('https://www.saucedemo.com/inventory.html');
    expect($('[data-test="shopping-cart-badge"]')).toBeDisplayed(); // expect: QCR-A003
    expect(browser).toHaveTitle('Swag Labs'); // expect: QCR-A003
  });
});
