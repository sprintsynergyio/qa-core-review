import { $, browser } from '@wdio/globals';

describe('Checkout', () => {
  it('shows the form', async () => {
    await browser.url('https://www.saucedemo.com/checkout-step-one.html');
    await expect($('[data-test="firstName"]')).toBeDisplayed({ wait: 10000 });
    await expect(browser).toHaveUrl(expect.stringContaining('checkout-step-one'));
  });
});
