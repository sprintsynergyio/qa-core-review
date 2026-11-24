import { $, browser } from '@wdio/globals';

describe('Checkout', () => {
  it('fills the first name', async () => {
    await browser.url('https://www.saucedemo.com/checkout-step-one.html');
    await $('//input[@data-test="firstName"]').setValue('Sam');
    await $('//form//input[@type="submit"]').click();
    await expect($('.error-message-container')).toBeDisplayed();
  });
});
